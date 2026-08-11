# Trace flow & log correlation — a worked example

Ran the full booking flow (search → hold → pay → verify → server-to-server confirm → notify) twice in a row, then pulled the real span trees and correlated logs from Tempo/Loki. This doc is the annotated result — real trace IDs, real timings, real log lines.

## Why run it twice: cold vs. warm, visible directly in span durations

| Step | Run 1 (cold) | Run 2 (warm) | Ratio |
|---|---|---|---|
| `POST /bookings` (booking-service root span) | 42,239 ms | 7,862 ms | 5.4× |
| `POST /payments/orders` | 38,613 ms | 3,440 ms | 11× |
| `POST /payments/verify` (incl. server-to-server confirm) | 8,447 ms | 292 ms | 29× |

That's not noise — it's directly explained by two specific spans:

- **Run 1's booking-service trace has an 11.5-second `CLIENT GET` span with a nested `tls.connect` (2.3s) + `dns.lookup` + `tcp.connect` underneath it, right before the call to flight-service.** That's the JWT-verification middleware fetching Keycloak's JWKS (public signing keys) over HTTPS for the first time. **Run 2 has no such span at all** — `jwks-rsa`'s in-memory key cache (from the Phase 2 JWT work) served the key locally, skipping the network round-trip entirely. This is the cache visibly working, not just configured.
- **Run 1's payment-verify trace has a 1-second `CLIENT POST` span right before the `PATCH` to booking-service** — that's `getServiceToken()` fetching a fresh client-credentials token from Keycloak. **Run 2 has no such span** — the token cache (also Phase 2) served it from memory.

One more thing worth flagging, found only because the trace made it visible: **flight-service's atomic seat-decrement `UPDATE` took 6.8s in run 1 and 7.5s in run 2** — consistently slow across both runs, unlike everything else that got fast on the second pass. That's not a cold-cache effect; it's either genuine host resource pressure (this environment has shown intermittent high load throughout this session) or worth a closer look on its own. This is exactly the kind of thing distributed tracing is for — it wouldn't be visible from the outside; the request "succeeded," just slowly.

## Span tree 1: `POST /bookings` — two services, one hop

Trace `d882f49e5f5de79ed794d4a0b54aaa7b` (run 1), booking-service → flight-service:

```
booking-service   SERVER   POST /bookings                              [42238.8ms]  ← root, receives the request
├─ booking-service  CLIENT   GET  (JWKS fetch, cold)                   [11484.1ms]
│  ├─ tls.connect                                                      [ 2273.1ms]
│  ├─ dns.lookup                                                       [  161.0ms]
│  └─ tcp.connect                                                      [  163.0ms]
└─ booking-service  CLIENT   POST (→ flight-service, holdFlightInventory) [14570.0ms]
   ├─ tcp.connect                                                      [  958.8ms]
   ├─ dns.lookup                                                       [  955.7ms]
   └─ flight-service SERVER   POST /flights/{id}/hold                  [12987.2ms]  ← NEW SERVICE, same trace
      ├─ flightdb → UPDATE   (atomic seat decrement)                   [ 6836.4ms]
      ├─ flightdb → SELECT [flights]  (re-read after hold)             [    2.1ms]
      └─ flightdb → INSERT  (new FlightHold row, Phase 1 work)         [ 6118.1ms]
booking-service  CLIENT   insert bookings (Mongo write)                [ 1546.1ms]
```

**The mechanic that makes this one trace instead of two:** booking-service's outbound `CLIENT POST` span and flight-service's inbound `SERVER POST /flights/{id}/hold` span share the same `trace_id`, and the CLIENT span's ID is literally the SERVER span's `parentSpanId`. That linkage travels over the wire as a `traceparent` HTTP header (W3C Trace Context) — Node's `http` client instrumentation stamps it on the way out, ASP.NET Core's server instrumentation reads it on the way in. Neither service's code does this manually; it's automatic, and it works correctly across two completely different languages and HTTP stacks.

## Span tree 2: `POST /payments/verify` — three services, two hops

Trace `15198fdb1c04cb7fd8fb87af3ad6755b` (run 2, the fast one), payment-service → booking-service → flight-service — this is the Phase 2 server-to-server confirmation feature, captured live:

```
payment-service  SERVER   POST /payments/verify                       [292.0ms]  ← root
├─ SELECT / INSERT / UPDATE paymentdb  (order lookup, event insert, status update)
└─ payment-service  CLIENT   PATCH (→ booking-service, notify_booking_status)  [139.1ms]
   └─ booking-service  SERVER   PATCH /bookings/:id/status              [136.9ms]  ← HOP 1
      ├─ find bookings   (Mongo)                                        [  0.5ms]
      ├─ update bookings (Mongo, status → CONFIRMED)                    [  1.7ms]
      └─ booking-service  CLIENT   POST (→ flight-service, confirmFlightHold) [497.8ms]
         └─ flight-service  SERVER   POST /flights/holds/{id}/confirm   [486.2ms]  ← HOP 2
            └─ flightdb → UPDATE  (hold status → CONFIRMED)             [481.4ms]
```

Same mechanic, twice in a row: payment-service's `CLIENT PATCH` parents booking-service's `SERVER PATCH`; booking-service's `CLIENT POST` parents flight-service's `SERVER POST`. One `trace_id`, three services, two independently-propagated hops, three different languages (Python → Node → .NET) — and none of it required a single line of manual instrumentation code. This is the clearest evidence in the whole repo that auto-instrumentation's context propagation is genuinely working end-to-end, not just configured.

## Log correlation: from a trace ID to the exact log lines

Given a `trace_id` from Tempo, the logs from every service involved in that request are one query away — **if that service produces logs at all** (see `README.md` in this folder for which 3 of 5 currently do).

```sh
curl -s -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={service_name="flight-service"} | trace_id="15198fdb1c04cb7fd8fb87af3ad6755b"' \
  --data-urlencode "start=<unix-ns>" --data-urlencode "end=<unix-ns>"
```

Result — every log line ASP.NET Core/EF Core emitted during that exact request, each carrying its own `span_id` so you can tell *which span* logged it, not just which trace:

```
span_id=f65bb9537aa448e3  Microsoft.AspNetCore.Hosting.Diagnostics       "Request starting..."
span_id=f65bb9537aa448e3  Microsoft.AspNetCore.Hosting.Diagnostics       "Request finished..."
span_id=f65bb9537aa448e3  Microsoft.AspNetCore.Routing.EndpointMiddleware "Executing endpoint..."
span_id=f65bb9537aa448e3  Microsoft.AspNetCore.Http.Result.OkObjectResult "Setting HTTP status code..."
span_id=f3b16cb139670e59  Microsoft.EntityFrameworkCore.Database.Command  "Executed DbCommand..."
```

The first four share `span_id=f65...` (the SERVER span itself); the DB command log has a *different* `span_id=f3b...` — the nested EF Core CLIENT span underneath it. That's the granularity: not just "this log happened during this request," but "this log happened during this specific unit of work within the request."

**One non-obvious Loki-specific gotcha, found by hitting it directly:** `{trace_id="..."}` as a bare query — no other label — returns **nothing**, even though the trace_id genuinely exists in the data. `trace_id`/`span_id` ride along as *structured metadata* per log line, not as indexed stream labels (deliberately — trace IDs are unique per request, and Loki's index would explode if every request created a new label-defined stream). You have to query by a real indexed label first (`service_name`, `severity_text`, etc.) and add the trace filter as a `| trace_id="..."` expression afterward. Loki *will* show you the trace_id value in results either way, which makes it easy to assume the bare-label query should also work — it doesn't.

## Bookings created during this walkthrough

For reference, in case you want to re-query these directly: `33c0a0a4-d912-49a0-8f6d-a41638b2a0a1` (run 1), `ad6368a6-cb29-4a9b-9ccd-8d31bedb78db` (run 2). Both ended `CONFIRMED`.

---

## Error flows: what failure actually looks like in traces, metrics, and logs

Deliberately triggered five failure scenarios against the live stack and inspected the resulting telemetry the same way as above. The headline result: **whether a failure is visible depends entirely on which signal you look at, and HTTP status code alone is a bad predictor of that.**

| # | Scenario | HTTP result | Span `status` | Metric labeled? | Distinct log line? |
|---|---|---|---|---|---|
| 1 | `POST /bookings` with no `Authorization` header | `401` | Unset | Yes (`http_response_status_code="401"`) | No — generic request/response INFO only |
| 2 | `POST /bookings` with a nonexistent `flightId` (flight-service can't hold it → booking-service maps to conflict) | `409` | **Unset on both SERVER spans; `STATUS_CODE_ERROR` on the calling booking-service's CLIENT span** | Yes (`"409"`) | No |
| 3 | `POST /payments/verify` with a forged signature | **`200`** — body is `{"signature_valid":false,"status":"FAILED"}` | Unset (it's a 200) | No (label says `"200"`, indistinguishable from a real success) | No |
| 4 | `POST /flights/holds/{id}/confirm` on a hold that doesn't exist | `404` | Unset | Yes (`"404"`) | No |
| 5 | `GET /bookings/{id}` for a nonexistent booking | `404` | Unset | Yes (`"404"`) | No |

Three findings worth calling out individually:

**1. A 4xx SERVER span is not marked as an error — but the caller's CLIENT span for that same failed call is.** Scenario 2's trace has flight-service's `SERVER POST /flights/{id}/hold` return 409 with `status: {}` (Unset), while booking-service's `CLIENT POST` — the span representing *making that call* — carries `status.code: STATUS_CODE_ERROR`. This is spec-correct, not a bug: OTel's HTTP semantic conventions treat 4xx as "the client's fault" from the server's point of view (so the server's own span shouldn't self-flag as erroring), but the exact same status code is unambiguously an error from the caller's point of view. Practical effect: **searching Tempo for `status=error` will surface booking-service's outbound-call failures but will never surface flight-service's own 404/409/401 responses** — you have to search by `http.response.status_code` instead if you want the callee-side view.

**2. Metrics see every one of these — including the 200-that's-secretly-a-failure's real siblings, just not #3 itself.** `http_server_request_duration_seconds_count` in Prometheus carries `http_response_status_code` as a genuine label for all of 401/404/405/409 (confirmed directly — see raw label sets), meaning an error-rate dashboard/alert (`rate(...{http_response_status_code=~"4..|5.."}[5m])`) is buildable today with zero code changes. This is actually the most complete error signal of the three — better than traces for this purpose, since it doesn't have the SERVER-span blind spot from finding #1.

**3. Scenario 3 is the real gap, and it's a business-logic failure, not an HTTP failure.** A forged Razorpay signature is correctly rejected by the app (`signature_valid: false`), but the endpoint returns `200 OK` with the failure encoded only in the JSON body. That means: the span has no error status, the metric's status-code label reads `"200"` — identical to a real successful verification — and no WARN/ERROR-severity log line was emitted anywhere (checked flight-service, payment-service, auth-service directly; payment-service produces no logs of its own for this branch beyond the standard request-tracing spans). **This specific class of failure is currently invisible to telemetry-only monitoring.** The only way to detect it today is to inspect response bodies at the application layer, or to add a manual span attribute (e.g. `payment.verification_result="failed"`) or a domain counter (`payment_verifications_total{result="failed"}`) — exactly the kind of business/domain instrumentation flagged as absent in `telemetry-schema-analysis.md`. If the goal is to demo *why* manual instrumentation matters, this is the single clearest example in the whole app.

**4. Nothing elevates log severity for expected/handled failures.** Every one of these five scenarios produced only `Information`-level log lines from ASP.NET Core's own request-pipeline logging (`Request starting/finished`, `Setting HTTP status code {StatusCode}`) — never a `Warning` or `Error`. The application code paths that produce 404/409 (`Hold not found`, `Flight is sold out...`) don't log anything themselves; that message only ever reaches the HTTP response body. So even where a log line *does* exist (unlike booking-service, which logs nothing to OTel at all — see README), its severity gives no signal that anything went wrong, and its body doesn't contain the actual error reason either — that requires reading the span's `http.response.status_code` attribute or the response payload, not the log stream.
