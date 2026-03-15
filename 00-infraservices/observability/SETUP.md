# Observability Setup

This stack provisions:
- OpenTelemetry Collector (OTLP receiver + Prometheus exporter)
- Prometheus (scraping collector metrics)
- Grafana (pre-provisioned Prometheus datasource)

## Start

From repo root:

```bash
podman compose -f 00-infraservices/observability-docker-compose.yml up -d
```

## Endpoints

- OTLP gRPC: `http://localhost:4317`
- OTLP HTTP: `http://localhost:4318`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (admin/admin)

## Send Metrics (example)

Point your services to the collector:

- OTLP endpoint: `http://opentelemetry-collector:4317`
- Or from host: `http://localhost:4317`

## UI Logs (nginx)

Both UIs emit JSON access logs to a shared volume at `/opt/app-root/src/logs/nginx`.
The collector `filelog` receivers ingest `*.access.log` and `*.error.log` from `/var/log/nginx`
(mounted to the same volume).

## Prometheus Scrapes

Prometheus is configured to scrape:
- `opentelemetry-collector:8889`
- `opentelemetry-collector:8888`

Add additional services by editing:
`00-infraservices/observability/prometheus/prometheus.yml`
