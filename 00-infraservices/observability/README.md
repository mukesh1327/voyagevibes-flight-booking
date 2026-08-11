# Observability pipeline

VoyageVibes exists partly as example workload for OpenTelemetry demos, so this doc tracks what's actually flowing through the pipeline, not just what's configured.

For a deep dive into the OTel data model itself (Resource/Span/Metric/Log schemas, semantic conventions) and exactly which parts of that schema this project's live telemetry actually exercises, see [telemetry-schema-analysis.md](./telemetry-schema-analysis.md).

For a worked example of an actual request's trace tree across services, plus the exact query syntax to correlate its logs, see [trace-flow-walkthrough.md](./trace-flow-walkthrough.md).

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

## Status as of 2026-08-10

| Signal | Status | Detail |
|---|---|---|
| **Metrics** | Working, 4/5 services | auth, booking, flight, payment export live, fresh metric sets (18–48 distinct series each — HTTP/DB durations, GC stats, runtime metrics). `notification-service` doesn't produce metrics — its eBPF sidecar can't attach at all (see below). |
| **Traces** | Working, 4/5 services | auth, booking, flight, payment all confirmed exporting to Tempo. `notification-service` absent (eBPF sidecar issue, see below). |
| **Logs** | Working, 3/5 services | auth, flight, payment confirmed in Loki. `booking-service` absent — structural, not broken (see below). `notification-service` absent (eBPF). |

### Root causes found (2026-08-10 investigation)

**Traces/logs were stuck for auth/booking/payment despite metrics working fine.** Root cause: these services had been running for hours across multiple restarts of the observability backend (otel-collector/Tempo/Loki got restarted independently of the app containers during earlier work). Their OTLP exporters' long-lived connections went stale and didn't self-recover. **Fix: recreate the affected containers** (`podman compose ... up -d --no-deps --force-recreate <service>` — plain `up -d` won't do it if compose sees no config diff). Confirmed immediately after recreation: traces and logs started flowing on the next request.

**Operational gotcha, worth remembering:** if you restart otel-collector/Tempo/Loki/Prometheus/Grafana without also restarting the 4 in-process-SDK-instrumented services (auth, booking, flight, payment), expect traces/logs to silently stop until those services are recreated too. Metrics are more resilient to this (periodic export re-attempts on a shorter cycle) which is why they kept working when traces/logs didn't — this asymmetry is what made the bug non-obvious.

**`booking-service` missing from logs is structural, not a bug.** It uses plain `console.log`/`console.error`; Node's `@opentelemetry/auto-instrumentations-node/register` auto-instruments HTTP/Mongo/etc. but does **not** bridge `console.*` to OTel logs without an explicit transport (e.g. winston/pino + a log-bridge package). This is real missing coverage, fixable with a small code addition — candidate for the Phase 3 structured-logging work, not something to "just restart."

**`notification-service` missing from all three signals is an environment constraint, not fixable in application code.** Its eBPF sidecar (`notification-go-auto`) loops forever with `failed to set memlock rlimit: operation not permitted` — rootless Podman doesn't grant the eBPF instrumentation the privilege it needs to allocate its maps, even with `privileged: true` set on the container. Same applies to `voyagevibes-ui-auto` (frontend eBPF sidecar), which has the same instability. Would need a different container runtime (rootful Docker, or a Kubernetes node with the right host config) to actually work.

**`voyagevibes-ui-auto` is commented out in `docker-compose.otel.yml` as of 2026-08-11.** It was tight-looping every ~4s (3500+ restarts observed) on the exact same memlock error, and `restart: unless-stopped` meant it never gave up — pure overhead (CPU churn, log volume) on an already resource-constrained host, with zero chance of success given the rootless-Podman constraint above. Uncomment the service block if this ever runs on rootful Docker or a Kubernetes node capable of granting the eBPF privilege. `notification-go-auto` has the identical failure mode and was left running (not asked about) — same fix applies if it becomes a problem.

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
