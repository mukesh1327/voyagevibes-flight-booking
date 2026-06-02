#!/bin/bash
set -euo pipefail

admin_base_url="${KONG_ADMIN_BASE_URL:-http://kong_gateway:8001}"
auth_service_runtime="${AUTH_SERVICE_RUNTIME:-development}"
auth_service_port="${AUTH_SERVICE_PORT:-8081}"
auth_service_dev_url="${AUTH_SERVICE_DEV_URL:-http://host.containers.internal:${auth_service_port}}"
auth_service_prod_url="${AUTH_SERVICE_PROD_URL:-http://auth-service:${auth_service_port}/auth}"
customer_api_host="${CUSTOMER_API_HOST:-customer-api.voyagevibes.in}"
corporate_api_host="${CORPORATE_API_HOST:-corp-api.voyagevibes.in}"

wait_for_kong() {
  until curl -fsS "${admin_base_url}/services" >/dev/null; do
    echo "waiting for kong admin api..."
    sleep 2
  done
}

resolve_auth_service_url() {
  if [[ -n "${AUTH_SERVICE_URL:-}" ]]; then
    echo "${AUTH_SERVICE_URL}"
    return
  fi

  case "${auth_service_runtime}" in
    development)
      echo "${auth_service_dev_url}"
      ;;
    production)
      echo "${auth_service_prod_url}"
      ;;
    *)
      echo "unsupported AUTH_SERVICE_RUNTIME: ${auth_service_runtime}" >&2
      exit 1
      ;;
  esac
}

ensure_service() {
  local name="$1"
  local url="$2"

  if curl -fsS "${admin_base_url}/services/${name}" >/dev/null 2>&1; then
    curl -fsS -X PATCH "${admin_base_url}/services/${name}" \
      --data-urlencode "url=${url}" >/dev/null
    echo "service updated: ${name}"
    return
  fi

  curl -fsS -X POST "${admin_base_url}/services" \
    --data-urlencode "name=${name}" \
    --data-urlencode "url=${url}" >/dev/null

  echo "service created: ${name}"
}

ensure_route() {
  local service_name="$1"
  local route_name="$2"
  local host="$3"
  local strip_path="$4"
  shift 4

  local args=(
    --data-urlencode "name=${route_name}"
    --data-urlencode "hosts[]=${host}"
    --data-urlencode "strip_path=${strip_path}"
  )

  if curl -fsS "${admin_base_url}/routes/${route_name}" >/dev/null 2>&1; then
    local path
    for path in "$@"; do
      args+=(--data-urlencode "paths[]=${path}")
    done

    curl -fsS -X PATCH "${admin_base_url}/routes/${route_name}" "${args[@]}" >/dev/null
    echo "route updated: ${route_name}"
    return
  fi

  args=(-X POST "${admin_base_url}/services/${service_name}/routes" "${args[@]}")

  local path
  for path in "$@"; do
    args+=(--data-urlencode "paths[]=${path}")
  done

  curl -fsS "${args[@]}" >/dev/null
  echo "route created: ${route_name}"
}

wait_for_kong

auth_service_url="$(resolve_auth_service_url)"

echo "registering auth-service upstream: ${auth_service_url}"

ensure_service "auth-service" "${auth_service_url}"

ensure_route "auth-service" "auth-api-local" "localhost" "true" "/api/v1/auth"

ensure_route "auth-service" "customer-auth-api" "${customer_api_host}" "true" "/api/v1/auth"

ensure_route "auth-service" "corp-auth-api" "${corporate_api_host}" "true" "/api/v1/auth"
