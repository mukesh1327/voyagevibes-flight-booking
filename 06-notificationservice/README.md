# Notification service

## Prerequisites
- Go 1.22+
- Optional: Docker Desktop / Docker Engine if you want to run containers

## Build and run (Go)
macOS / Linux:
```bash
go mod download
go build -o out/notification-service ./cmd/notificationservice
./out/notification-service
```

Windows (PowerShell):
```powershell
go mod download
go build -o out\notification-service.exe .\cmd\notificationservice
.\out\notification-service.exe
```

By default the service starts on `https://notification.voyagevibes.in:8087` using the certs in `https-certs`. You can override this with `HTTPS_ENABLED`, `TLS_CERT_FILE`, `TLS_KEY_FILE`, or `HTTP_HOST` if needed.

## Docker (Containerfile uses UBI9)
The Containerfile expects a prebuilt binary at `out/notification-service`.
```bash
go build -o out/notification-service ./cmd/notificationservice
docker build -f docker/Containerfile -t notification-service:local .
docker run --rm -p 8087:8087 --env-file .env notification-service:local
```

## Docker Compose (includes Postgres + Redis)
```bash
docker compose -f notificationservice-docker-compose.yml up --build
```