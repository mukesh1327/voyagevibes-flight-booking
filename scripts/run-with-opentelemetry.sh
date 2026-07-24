#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
BASE_COMPOSE="${REPO_ROOT}/docker-compose.yml"
OTEL_COMPOSE="${REPO_ROOT}/docker-compose.otel.yml"
PROJECT_NAME=${COMPOSE_PROJECT_NAME:-voyagevibes}
STACK_SERVICES="kong-routes-init auth-service flight-service booking-service payment-service notification-service notification-go-auto voyagevibes-ui voyagevibes-ui-auto grafana"

ensure_local_env() {
  target=$1
  example="${target}.example"

  if [ ! -f "${target}" ]; then
    if [ ! -f "${example}" ]; then
      echo "Missing both ${target} and ${example}" >&2
      exit 1
    fi

    cp "${example}" "${target}"
    echo "Created local development environment: ${target}"
  fi
}

detect_engine() {
  if [ -n "${CONTAINER_ENGINE:-}" ]; then
    printf '%s\n' "${CONTAINER_ENGINE}"
  elif command -v podman >/dev/null 2>&1; then
    printf '%s\n' podman
  elif command -v docker >/dev/null 2>&1; then
    printf '%s\n' docker
  else
    echo "Neither Podman nor Docker is available." >&2
    exit 1
  fi
}

compose() {
  "${ENGINE}" compose \
    --project-name "${PROJECT_NAME}" \
    --file "${BASE_COMPOSE}" \
    --file "${OTEL_COMPOSE}" \
    "$@"
}

ensure_local_env "${REPO_ROOT}/00-infraservices/databases/postgres/.env"
ensure_local_env "${REPO_ROOT}/00-infraservices/keycloak/.env"
ensure_local_env "${REPO_ROOT}/00-infraservices/gateway/kong/.env"
ensure_local_env "${REPO_ROOT}/01-authservice/.env"
ensure_local_env "${REPO_ROOT}/voyagevibes/.env"

ENGINE=$(detect_engine)
ACTION=${1:-up}
if [ "$#" -gt 0 ]; then
  shift
fi

case "${ACTION}" in
  up)
    compose config >/dev/null
    compose up --detach --build "$@" ${STACK_SERVICES}
    # Nginx resolves the Kong container name when it starts. Refresh it after
    # Compose updates so it cannot retain the IP of a replaced Kong container.
    compose restart voyagevibes-ui
    echo
    echo "VoyageVibes: https://localhost:9001"
    echo "Grafana:     http://localhost:3000  (admin/admin)"
    echo "Prometheus:  http://localhost:9091"
    echo "Tempo API:   http://localhost:3200"
    echo "Loki API:    http://localhost:3100"
    echo "OTLP HTTP:   http://localhost:4318"
    ;;
  down)
    compose down "$@"
    ;;
  restart)
    compose down
    compose up --detach --build "$@" ${STACK_SERVICES}
    ;;
  logs)
    compose logs "$@"
    ;;
  ps)
    compose ps "$@"
    ;;
  config)
    compose config "$@"
    ;;
  *)
    echo "Usage: $0 {up|down|restart|logs|ps|config} [compose options]" >&2
    exit 2
    ;;
esac
