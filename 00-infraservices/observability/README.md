# Observability pipeline

VoyageVibes exists partly as example workload for OpenTelemetry demos, so this doc tracks what's actually flowing through the pipeline, not just what's configured.

## Architecture

```
5 services + UI  --OTLP (grpc/http)-->  otel-collector  --+--> Tempo      (traces)
                                                            +--> Prometheus (metrics, via :8889 scrape)
                                                            +--> Loki       (logs, OTLP endpoint)
                                                            +--> Makara telemetry-platform gateway (additive dual-export)
```

- Collector config: `opentelemetry/config/otel-collector.yml`
- Backends: `tempo/`, `loki/`, `prometheus/`, `grafana/` (each has its own `*-dockercompose.yml` + config)
- Every service gets `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`, `OTEL_TRACES_SAMPLER=parentbased_always_on` (100% sampling) via the shared `otel-environment` anchor in the root `docker-compose.otel.yml`.
- Instrumentation is 100% **auto-instrumentation** right now — Java agent (auth-service), .NET auto-instrumentation (flight-service), Node `--require @opentelemetry/auto-instrumentations-node/register` (booking-service), `opentelemetry-instrument` wrapper (payment-service), eBPF (`otel/ebpf-instrument`) for notification-service and the frontend. No service has a custom `Tracer`/`ActivitySource`/manual span anywhere in the code yet.

Run the full stack (base + otel overlay): `sh scripts/run-with-opentelemetry.sh up`. Grafana at `http://localhost:3033` (remapped from 3000 to avoid a host conflict), Tempo API at `:3200`, Loki API at `:3100`, Prometheus at `:9091`.

## Status as of 2026-08-06

| Signal | Status | Detail |
|---|---|---|
| **Metrics** | Working, 4/5 services | auth, booking, flight, payment all export live, fresh metric sets (18–48 distinct series each — HTTP/DB durations, GC stats, runtime metrics). `notification-service` (eBPF) doesn't produce metrics — expected, eBPF instrumentation only captures HTTP-level trace data. |
| **Traces** | Broken almost everywhere | Tempo has traces **only** from flight-service's internal 30s background job (the hold-expiry sweep querying the DB via EF Core/SqlClient instrumentation). Zero HTTP-request-triggered traces from **any** service, confirmed live by hitting fresh endpoints on all 5 services and re-querying — nothing new appears, despite the corresponding HTTP metrics existing with live timestamps. Root cause not yet identified — instrumentation is clearly firing (metrics prove it) but trace export isn't reaching Tempo. |
| **Logs** | Broken almost everywhere | Loki only has `flight-service`, and even that is just the raw, uninterpolated EF Core log template (`"Executed DbCommand ({elapsed}ms)..."` — the `{elapsed}` placeholder literally unfilled) bridged automatically from ASP.NET Core's internal framework logging. Nothing from auth-service (Logback), booking-service (console.log/error), or payment-service (Python `logging`), despite all three genuinely producing log output to stdout. |

**Net read:** the collector → backend plumbing is proven fine (metrics prove it end-to-end). The gap is specifically in how each language's SDK/agent is (or isn't) exporting traces and logs — worth a real root-cause pass rather than more guessing. This is the natural next step for the "Phase 3: telemetry richness" work (business-context span attributes, structured trace-correlated logging, fault-injection knobs, browser RUM — see the codebase-findings artifact from the earlier analysis session).

## How to check this yourself

```sh
# Traces: what service names/root spans has Tempo actually seen?
curl -s "http://localhost:3200/api/search/tag/service.name/values" | python3 -m json.tool
curl -s "http://localhost:3200/api/search?limit=50" | python3 -m json.tool

# Metrics: which services are exporting, and what metric names?
curl -s "http://localhost:9091/api/v1/label/service_name/values" | python3 -m json.tool
curl -s "http://localhost:9091/api/v1/query" --data-urlencode 'query=count by (__name__,service_name)({service_name=~".+"})' | python3 -m json.tool

# Logs: which services have log streams in Loki?
curl -s "http://localhost:3100/loki/api/v1/label/service_name/values" | python3 -m json.tool
```

## Identifying manual vs. auto-instrumented telemetry

Every span/metric/log in OTel carries an **instrumentation scope** — the name+version of the library that produced it. This is the authoritative signal:

```sh
curl -s "http://localhost:9091/api/v1/query" \
  --data-urlencode 'query=group by (otel_scope_name, service_name) (http_server_request_duration_seconds_bucket)'
```

| Scope name looks like... | Means |
|---|---|
| `OpenTelemetry.Instrumentation.SqlClient`, `@opentelemetry/instrumentation-http`, `io.opentelemetry.tomcat-10.0`, `Microsoft.AspNetCore.Hosting` | **Auto-instrumented** — a real, versioned, publicly-published OTel contrib package |
| Your own service/app name, or anything you made up | **Manual** — someone called `tracer.startSpan(...)` / `ActivitySource.StartActivity(...)` themselves |

Other tells, in order of reliability:

1. **Naming convention** — auto span/metric names are formulaic and match the [OTel semantic conventions](https://opentelemetry.io/docs/specs/semconv/) spec exactly (`GET /flights/{id}`, `SELECT flightdb`, `http.server.request.duration`). Manual spans read like business language (`booking.create`, `payment.verify_signature`) because a developer named them to mean something to *them*.
2. **Attribute vocabulary** — auto-instrumentation only knows generic transport facts (`http.*`, `db.*`, `net.*`, `url.*`). It has zero concept of "booking" or "flight". An attribute like `flight.origin=DEL` or `payment.mode=mock` is unambiguously hand-added.
3. **Shape/regularity** — auto spans carry the same attribute set on every call. Manual instrumentation tends to be conditional (attributes set only on certain outcomes, custom span events) because it follows actual business branches.

**Current verdict for this repo:** 100% auto-instrumented, 0% manual, across every service and every signal (verified directly — see scope names above, e.g. `OpenTelemetry.Instrumentation.EntityFrameworkCore`, `OpenTelemetry.Instrumentation.SqlClient`). The moment real business attributes start showing up (`booking.status`, `flight.origin`, etc.), that's the Phase 3 manual-instrumentation work landing.
