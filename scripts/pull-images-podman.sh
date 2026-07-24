#!/bin/sh

set -eu

# Runtime and infrastructure images.
podman pull docker.io/apache/kafka:3.8.0
podman pull docker.io/dxflrs/garage:v2.2.0
podman pull docker.io/khairul169/garage-webui:1.1.0
podman pull docker.io/grafana/grafana:latest
podman pull docker.io/grafana/loki:latest
podman pull docker.io/grafana/tempo:latest
podman pull docker.io/library/kong:latest
podman pull docker.io/library/mongo:7
podman pull docker.io/library/postgres:16
podman pull docker.io/library/redis:7-alpine
podman pull docker.io/otel/ebpf-instrument:main
podman pull docker.io/otel/opentelemetry-collector-contrib:0.157.0
podman pull docker.io/prom/prometheus:latest
podman pull mcr.microsoft.com/mssql/server:2022-latest
podman pull quay.io/keycloak/keycloak:25.0

# Build-stage and application base images.
podman pull docker.io/library/alpine:3.20
podman pull docker.io/library/busybox:1.37.0-uclibc
podman pull docker.io/library/eclipse-temurin:21-jdk
podman pull docker.io/library/eclipse-temurin:21-jre
podman pull docker.io/library/golang:1.25-alpine
podman pull docker.io/library/nginx:1.27-alpine
podman pull docker.io/library/node:22-alpine
podman pull docker.io/library/python:3.12-slim
podman pull docker.io/otel/autoinstrumentation-go:latest
podman pull mcr.microsoft.com/dotnet/aspnet:8.0
podman pull mcr.microsoft.com/dotnet/sdk:8.0
