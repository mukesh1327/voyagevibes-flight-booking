#!/bin/bash
set -euo pipefail

admin_base_url="${KONG_ADMIN_BASE_URL:-http://kong_gateway:8001}"
auth_service_runtime="${AUTH_SERVICE_RUNTIME:-development}"
auth_service_port="${AUTH_SERVICE_PORT:-8081}"
auth_service_dev_url="${AUTH_SERVICE_DEV_URL:-http://host.containers.internal:${auth_service_port}/auth}"
auth_service_prod_url="${AUTH_SERVICE_PROD_URL:-http://auth-service:${auth_service_port}/auth}"
flight_service_dev_url="${FLIGHT_SERVICE_DEV_URL:-http://host.containers.internal:8083/flights}"
flight_service_prod_url="${FLIGHT_SERVICE_PROD_URL:-http://flight-service:8083/flights}"
booking_service_dev_url="${BOOKING_SERVICE_DEV_URL:-http://host.containers.internal:8084/bookings}"
booking_service_prod_url="${BOOKING_SERVICE_PROD_URL:-http://booking-service:8084/bookings}"
payment_service_dev_url="${PAYMENT_SERVICE_DEV_URL:-http://host.containers.internal:8085/payments}"
payment_service_prod_url="${PAYMENT_SERVICE_PROD_URL:-http://payment-service:8085/payments}"
notification_service_dev_url="${NOTIFICATION_SERVICE_DEV_URL:-http://host.containers.internal:8086/notifications}"
notification_service_prod_url="${NOTIFICATION_SERVICE_PROD_URL:-http://notification-service:8086/notifications}"
customer_api_host="${CUSTOMER_API_HOST:-customer-api.voyagevibes.in}"
corporate_api_host="${CORPORATE_API_HOST:-corp-api.voyagevibes.in}"

wait_for_kong() {
  until curl -fsS "${admin_base_url}/services" >/dev/null; do
    echo "waiting for kong admin api..."
    sleep 2
  done
}

resolve_auth_service_url() {
  resolve_service_url "${AUTH_SERVICE_URL:-}" "${auth_service_dev_url}" "${auth_service_prod_url}" "/auth"
}

resolve_service_url() {
  local explicit_url="$1"
  local dev_url="$2"
  local prod_url="$3"
  local suffix="$4"
  local configured_url

  if [[ -n "${explicit_url}" ]]; then
    configured_url="${explicit_url}"
  else
    case "${auth_service_runtime}" in
      development)
        configured_url="${dev_url}"
        ;;
      production)
        configured_url="${prod_url}"
        ;;
      *)
        echo "unsupported AUTH_SERVICE_RUNTIME: ${auth_service_runtime}" >&2
        exit 1
        ;;
    esac
  fi

  configured_url="${configured_url%/}"
  if [[ "${configured_url}" != *"${suffix}" ]]; then
    configured_url="${configured_url}${suffix}"
  fi

  echo "${configured_url}"
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
flight_service_url="$(resolve_service_url "${FLIGHT_SERVICE_URL:-}" "${flight_service_dev_url}" "${flight_service_prod_url}" "/flights")"
booking_service_url="$(resolve_service_url "${BOOKING_SERVICE_URL:-}" "${booking_service_dev_url}" "${booking_service_prod_url}" "/bookings")"
payment_service_url="$(resolve_service_url "${PAYMENT_SERVICE_URL:-}" "${payment_service_dev_url}" "${payment_service_prod_url}" "/payments")"
notification_service_url="$(resolve_service_url "${NOTIFICATION_SERVICE_URL:-}" "${notification_service_dev_url}" "${notification_service_prod_url}" "/notifications")"

echo "registering auth-service upstream: ${auth_service_url}"
echo "registering flight-service upstream: ${flight_service_url}"
echo "registering booking-service upstream: ${booking_service_url}"
echo "registering payment-service upstream: ${payment_service_url}"
echo "registering notification-service upstream: ${notification_service_url}"

ensure_service "auth-service" "${auth_service_url}"
ensure_service "flight-service" "${flight_service_url}"
ensure_service "booking-service" "${booking_service_url}"
ensure_service "payment-service" "${payment_service_url}"
ensure_service "notification-service" "${notification_service_url}"

ensure_route "auth-service" "auth-api-local" "localhost" "true" "/api/v1/auth"
ensure_route "flight-service" "flight-api-local" "localhost" "true" "/api/v1/flights"
ensure_route "booking-service" "booking-api-local" "localhost" "true" "/api/v1/bookings"
ensure_route "payment-service" "payment-api-local" "localhost" "true" "/api/v1/payments"
ensure_route "notification-service" "notification-api-local" "localhost" "true" "/api/v1/notifications"

ensure_route "auth-service" "customer-auth-api" "${customer_api_host}" "true" "/api/v1/auth"
ensure_route "flight-service" "customer-flight-api" "${customer_api_host}" "true" "/api/v1/flights"
ensure_route "booking-service" "customer-booking-api" "${customer_api_host}" "true" "/api/v1/bookings"
ensure_route "payment-service" "customer-payment-api" "${customer_api_host}" "true" "/api/v1/payments"
ensure_route "notification-service" "customer-notification-api" "${customer_api_host}" "true" "/api/v1/notifications"

ensure_route "auth-service" "corp-auth-api" "${corporate_api_host}" "true" "/api/v1/auth"
ensure_route "flight-service" "corp-flight-api" "${corporate_api_host}" "true" "/api/v1/flights"
ensure_route "booking-service" "corp-booking-api" "${corporate_api_host}" "true" "/api/v1/bookings"
ensure_route "payment-service" "corp-payment-api" "${corporate_api_host}" "true" "/api/v1/payments"
ensure_route "notification-service" "corp-notification-api" "${corporate_api_host}" "true" "/api/v1/notifications"
