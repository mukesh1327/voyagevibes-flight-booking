# OpenTelemetry data schema — reference & live coverage analysis

Two parts: (1) what the OTel spec actually defines, researched from the official docs; (2) what's genuinely present in *this* project's live telemetry, verified by querying Tempo/Prometheus/Loki directly — not inferred from config.

## Part 1 — The OTel schema, as specified

### Signals

OTel defines four signals: **Traces**, **Metrics**, **Logs**, and the newer **Profiles** (continuous profiling — still evolving in the spec, not covered by any instrumentation in this repo). All four share the same **Resource** model and the same **Semantic Conventions** vocabulary, which is the whole point — a `service.name` or `http.request.method` attribute means the same thing regardless of which signal it's attached to.

### Resource — the "who produced this" model

Every span, metric, and log carries a Resource: a fixed set of attributes describing the producing entity. Spec-defined namespaces:

| Namespace | Describes |
|---|---|
| `service.*` | The logical service (name, version, namespace, instance.id) |
| `telemetry.sdk.*`, `telemetry.distro.*` | Which OTel SDK/agent produced the data |
| `host.*` | The physical/virtual machine |
| `os.*` | Operating system |
| `process.*` | The OS process (pid, runtime name/version, command) |
| `container.*` | Container identity |
| `k8s.*` | Kubernetes (namespace, pod, node, cluster, deployment...) |
| `cloud.*` (+ per-provider: `aws.*`, `gcp.*`, `azure.*`, `alibaba_cloud.*`, `tencent_cloud.*`, `heroku.*`) | Cloud provider context |
| `deployment.*` | Deployment environment name/id |
| `faas.*` | Serverless/function context |
| `device.*`, `browser.*` | Client-side/mobile resource info |
| `webengine.*` | Application server/web engine |
| `cicd.*`, `cloudfoundry.*` | CI/CD and PaaS metadata |

### Traces / Spans

A Span has: a name, a **SpanKind** (`INTERNAL` (default), `SERVER`, `CLIENT`, `PRODUCER`, `CONSUMER`), a **SpanContext** (`TraceId`, `SpanId`, `TraceFlags` per W3C Trace Context, `TraceState`), a **Status** (`Unset` → `Ok`/`Error`, with Ok always winning), zero or more timestamped **Events** (each with a name + attributes — the standard use is recording an exception: `exception.type`, `exception.message`, `exception.stacktrace`, `exception.escaped`), and zero or more **Links** to other spans (for causality outside the parent/child tree — e.g., batch processing, fan-out).

Span-level semantic convention namespaces: `http.*`, `db.*`, `rpc.*`, `messaging.*`, `faas.*`, `graphql.*`, object-store conventions, plus the always-available general namespaces `url.*`, `network.*`, `client.*`, `server.*`, `user_agent.*`, `error.*`, `code.*`.

### Metrics

Metric data points come in five types: **Sum** (additive, e.g. request counters), **Gauge** (non-additive point-in-time value, e.g. queue depth), **Histogram**, **ExponentialHistogram** (a compressed high-dynamic-range histogram — better for latency distributions with a wide range), and **Summary** (legacy, quantile-based). Sum/Histogram/ExponentialHistogram carry a **temporality**: *Cumulative* (value since process start) or *Delta* (value since last report).

### Logs (LogRecord)

Top-level fields: `Timestamp` (when it happened at the source), `ObservedTimestamp` (when the collection pipeline saw it — deliberately a separate field), `TraceId`/`SpanId`/`TraceFlags` (correlation to the active span, per W3C Trace Context), `SeverityNumber` (1–24, normalized across languages), `SeverityText` (the original string as the source framework wrote it, e.g. `"INFO"`), `Body` (the message, string or structured), `Resource`, `InstrumentationScope`, `Attributes`, and `EventName`.

Sources: [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/) · [Resource Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/resource/) · [Trace API / Span Data Model](https://opentelemetry.io/docs/specs/otel/trace/api/) · [Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/) · [Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/) · [General Trace Conventions index](https://opentelemetry.io/docs/specs/semconv/general/trace/)

---

## Part 2 — What's actually present in this project (live-verified)

Everything below was pulled directly from the running Tempo/Prometheus/Loki, not inferred from `otel-collector.yml`. See `README.md` in this folder for the reusable query commands.

### Resource — good coverage for a bare-metal/container deployment, correctly absent where it should be

A real flight-service span's full resource block:

```
container.id, deployment.environment.name, host.arch, host.name,
os.build_id, os.description, os.name, os.type, os.version,
process.creation.time, process.owner, process.pid,
process.runtime.description, process.runtime.name, process.runtime.version,
service.instance.id, service.namespace, service.name,
telemetry.distro.name, telemetry.distro.version,
telemetry.sdk.language, telemetry.sdk.name, telemetry.sdk.version
```

That's full coverage of `service.*`, `telemetry.*`, `host.*`, `os.*`, `process.*`, and partial `container.*` (only `container.id` — no `container.name`/`container.image.name`).

**`cloud.*` and `k8s.*` are correctly absent** — this runs on podman-compose on bare metal, not in a cloud account or a Kubernetes cluster, so there's nothing for those resource detectors to find. Their absence is *correct*, not a gap.

**`service.version` is inconsistent per service** — present on auth-service's logs (`service_version: "0.0.1-SNAPSHOT"`, from the Maven POM) but absent from flight-service's resource. Worth setting explicitly for services that don't get it for free (flight/booking/payment don't read a version from anywhere at build or runtime).

### Traces — SpanKind, Status, Events, Links, and semantic conventions are all genuinely exercised, not just configured

Confirmed directly from real spans:

- **SpanKind**: `SPAN_KIND_SERVER` (inbound HTTP) and `SPAN_KIND_CLIENT` (outbound DB/HTTP calls) both present with correct parent/child nesting.
- **Status**: `Unset` (the default, most spans) and `STATUS_CODE_ERROR` both observed live — the latter from a real Razorpay API failure during testing.
- **Events**: a real `exception` event was captured on that error span with the full standard field set — `exception.type` (`razorpay.errors.ServerError`), `exception.message`, `exception.stacktrace`, `exception.escaped` — exactly matching the spec's exception-event convention.
- **Links**: not observed anywhere. Expected — nothing in this app does fan-out/batch processing that would need cross-trace causality.
- **HTTP semconv**: excellent coverage on a booking-service span — `http.request.method`, `http.response.status_code`, `url.scheme`, `url.path`, `server.address`, `server.port`, `client.address`, `network.peer.address`, `network.peer.port`, `network.protocol.version`, `user_agent.original`. This is the full modern namespace set (`http.*` + `url.*` + `network.*` + `client.*`/`server.*` + `user_agent.*`), not a partial/legacy subset.
- **DB semconv**: also strong — `db.system.name`, `db.namespace`, `db.operation.name`, `db.collection.name`, `db.query.text` (correctly **parameterized/redacted**, e.g. `{"find":"?","filter":{"_id":"?"}}` — the instrumentation is not leaking real query values into traces, which is the security-conscious default working as intended).

### Metrics — Histogram is the dominant type in use; temporality is cumulative

Every service-level duration metric observed ends in `_bucket`/`_sum`/`_count` (e.g. `http_server_request_duration_seconds_bucket`), confirming **Histogram** is what's actually being emitted for latency data, per spec. Runtime metrics (`jvm_memory_used_bytes`, `process_runtime_dotnet_gc_heap_size_bytes`, `v8js_memory_heap_used_bytes`) are **Gauge**-shaped (point-in-time values, no `_bucket` suffix). No **Sum**/counter-style business metrics exist anywhere (e.g. nothing like `bookings_created_total`) — everything currently emitted is auto-instrumentation's transport/runtime metrics, not domain counters. See the separate CPU/memory-specific breakdown already in this repo's chat history for the per-service runtime-metric gap (Python has none at all).

### Logs — full LogRecord field compliance where logs exist at all

A raw auth-service log entry's actual label set:

```
trace_id, span_id, flags, severity_number, severity_text, observed_timestamp,
scope_name, service_name, service_namespace, service_version, service_instance_id,
host_arch, host_name, os_description, os_type, os_version,
process_command_args, process_executable_path, process_pid, process_runtime_*,
telemetry_distro_*, telemetry_sdk_*
```

This is complete `LogRecord` field coverage: `TraceId`/`SpanId`/`TraceFlags` for correlation (present and correct — `flags: '3'` = both W3C `SAMPLED` and `RANDOM` bits set), `SeverityNumber`/`SeverityText` (`9`/`INFO`, matching the spec's normalized 1–24 scale exactly), `ObservedTimestamp` as a genuinely separate field from the entry timestamp, full `Resource`, and `InstrumentationScope` (here, `scope_name` = `in.cloudxplorer.authservice.health.KeycloakHealthIndicator` — see note below).

**Nuance worth being precise about:** that scope name is the *application's own* logger name, not an OTel library name (compare to `OpenTelemetry.Instrumentation.SqlClient` for a genuinely auto-instrumented DB span). What's happening here is the Java agent auto-*bridging* — it takes log statements developers already wrote for their own purposes (e.g. auth-service's `KeycloakHealthIndicator` logging `"🔍 Keycloak Health Check: ✅ UP..."`) and exports them as OTel LogRecords with zero code changes required. So this sits in a middle ground: the *export mechanism* is 100% automatic, but the *log content* is real hand-written application messages, unlike the purely-synthetic HTTP/DB spans which have no human-authored content at all. Coverage is 3/5 services (auth, flight, payment); booking-service (plain `console.*`, no bridge) and notification-service (eBPF, can't bridge logs at all) are absent — see this folder's `README.md` for why.

---

## Part 3 — Net assessment

| Area | Verdict |
|---|---|
| Resource model | Strong, appropriate for the deployment target. Only real gap: inconsistent `service.version` across services. |
| Span structure (Kind/Status/Events) | Fully exercised, including the error/exception path, verified with a real captured error. |
| Span Links | Absent, but nothing in the app's actual request flow calls for them. |
| HTTP & DB semantic conventions | Comprehensive, modern-namespace coverage, with security-conscious query parameterization. |
| Metric types | Histograms for latency (correct choice), Gauges for runtime memory. Zero domain/business metrics (no counters like `bookings_created_total`) — everything is transport/runtime-level, nothing business-level. |
| LogRecord fields | Fully spec-compliant where logs exist; coverage gap is *which services* produce logs at all (3/5), not the schema quality of the ones that do. |
| Manual instrumentation | None (confirmed in a prior pass via `instrumentation.scope.name`) — the "app logger content via auto-bridge" nuance above is the closest thing to it, but no code anywhere calls the OTel Tracer/Meter/Logger APIs directly. |

The pattern across this whole analysis: **auto-instrumentation is doing a genuinely thorough, spec-faithful job everywhere it's active.** The gaps are entirely about *coverage* (which services/signals have working instrumentation at all — see this folder's `README.md` for the specific per-service breakdown and root causes) rather than *quality* (the instrumentation that does exist is not shallow or partial against the spec). The one true content gap is business/domain metrics and attributes — that's exactly the Phase 3 manual-instrumentation work (`booking.status`, `flight.origin`, `payment.mode`, `bookings_created_total`, etc.) that hasn't started yet.
