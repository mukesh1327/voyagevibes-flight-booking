#!/bin/bash
set -euo pipefail

admin_base_url="${KONG_ADMIN_BASE_URL:-http://kong_gateway:8001}"

wait_for_kong() {
  until curl -fsS "${admin_base_url}/services" >/dev/null; do
    echo "waiting for kong admin api..."
    sleep 2
  done
}

ensure_service() {
  local name="$1"
  local url="$2"

  if curl -fsS "${admin_base_url}/services/${name}" >/dev/null 2>&1; then
    echo "service exists: ${name}"
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
  shift 3

  if curl -fsS "${admin_base_url}/routes/${route_name}" >/dev/null 2>&1; then
    echo "route exists: ${route_name}"
    return
  fi

  local args=(
    -fsS
    -X POST "${admin_base_url}/services/${service_name}/routes"
    --data-urlencode "name=${route_name}"
    --data-urlencode "hosts[]=${host}"
    --data-urlencode "strip_path=false"
  )

  local path
  for path in "$@"; do
    args+=(--data-urlencode "paths[]=${path}")
  done

  curl "${args[@]}" >/dev/null
  echo "route created: ${route_name}"
}

wait_for_kong

ensure_service "auth-service" "http://auth-service:8081"
ensure_service "flight-service" "http://flight-service:8082"
ensure_service "booking-service" "http://booking-service:8083"
ensure_service "customer-service" "http://customer-service:8084"
ensure_service "payment-service" "http://payment-service:8085"
ensure_service "notification-service" "http://notification-service:8086"

ensure_route "auth-service" "customer-auth-api" "customer-api.voyagevibes.in" "/api/v1/auth"
ensure_route "flight-service" "customer-flight-api" "customer-api.voyagevibes.in" "/api/v1/flights" "/api/v1/pricing" "/api/v1/inventory"
ensure_route "booking-service" "customer-booking-api" "customer-api.voyagevibes.in" "/api/v1/bookings"
ensure_route "customer-service" "customer-profile-api" "customer-api.voyagevibes.in" "/api/v1/users"
ensure_route "payment-service" "customer-payment-api" "customer-api.voyagevibes.in" "/api/v1/payments"
ensure_route "notification-service" "customer-notification-otp-api" "customer-api.voyagevibes.in" "/api/v1/otp"

ensure_route "auth-service" "corp-auth-api" "corp-api.voyagevibes.in" "/api/v1/auth"
ensure_route "flight-service" "corp-flight-api" "corp-api.voyagevibes.in" "/api/v1/flights" "/api/v1/pricing" "/api/v1/inventory"
ensure_route "booking-service" "corp-booking-api" "corp-api.voyagevibes.in" "/api/v1/bookings"
ensure_route "payment-service" "corp-payment-api" "corp-api.voyagevibes.in" "/api/v1/payments"
ensure_route "notification-service" "corp-notification-otp-api" "corp-api.voyagevibes.in" "/api/v1/otp"
