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

## Prometheus Scrapes

Prometheus is configured to scrape:
- `opentelemetry-collector:8889`
- `opentelemetry-collector:8888`

Add additional services by editing:
`00-infraservices/observability/prometheus/prometheus.yml`
