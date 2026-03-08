package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.dto.health.HealthResponse;
import com.cloudxplorer.authservice.infrastructure.config.AuthServiceProperties;
import com.cloudxplorer.authservice.infrastructure.health.DependencyHealthChecker;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final AuthServiceProperties properties;
    private final DependencyHealthChecker dependencyHealthChecker;

    public HealthController(AuthServiceProperties properties, DependencyHealthChecker dependencyHealthChecker) {
        this.properties = properties;
        this.dependencyHealthChecker = dependencyHealthChecker;
    }

    @GetMapping
    public ResponseEntity<HealthResponse> health() {
        return buildDependencyAwareHealth("health");
    }

    @GetMapping("/ready")
    public ResponseEntity<HealthResponse> readiness() {
        return buildDependencyAwareHealth("readiness");
    }

    @GetMapping("/live")
    public ResponseEntity<HealthResponse> liveness() {
        return ResponseEntity.ok(buildResponse("UP", "liveness"));
    }

    private ResponseEntity<HealthResponse> buildDependencyAwareHealth(String mode) {
        Map<String, String> keycloakStatus = dependencyHealthChecker.checkKeycloak(
            properties.keycloak() != null ? properties.keycloak().baseUrl() : null
        );
        Map<String, String> dbStatus = dependencyHealthChecker.checkDatabase();
        boolean up = "UP".equals(keycloakStatus.get("status")) && "UP".equals(dbStatus.get("status"));

        Map<String, String> details = Map.of(
            "mode", mode,
            "keycloak.status", nullSafe(keycloakStatus.get("status"), "DOWN"),
            "keycloak.reason", nullSafe(keycloakStatus.get("reason"), "UNKNOWN"),
            "db.status", nullSafe(dbStatus.get("status"), "DOWN"),
            "db.reason", nullSafe(dbStatus.get("reason"), "UNKNOWN"),
            "db.target", nullSafe(dbStatus.get("target"), "N/A"),
            "hostname", nullSafe(properties.hostname(), "unset"),
            "appBaseUrl", nullSafe(properties.appBaseUrl(), "unset"),
            "environment", nullSafe(properties.activeEnv(), "unknown")
        );

        HealthResponse response = new HealthResponse(
            up ? "UP" : "DOWN",
            Instant.now().toString(),
            nullSafe(properties.activeEnv(), "unknown"),
            details
        );
        return ResponseEntity.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }

    private HealthResponse buildResponse(String status, String description) {
        Map<String, String> details = Map.of(
            "hostname", nullSafe(properties.hostname(), "unset"),
            "appBaseUrl", nullSafe(properties.appBaseUrl(), "unset"),
            "keycloakBaseUrl", nullSafe(properties.keycloak() != null ? properties.keycloak().baseUrl() : null, "unset"),
            "publicClientId", nullSafe(properties.publicClient() != null ? properties.publicClient().clientId() : null, "unset"),
            "corpClientId", nullSafe(properties.corp() != null ? properties.corp().clientId() : null, "unset"),
            "mode", description
        );

        return new HealthResponse(
            status,
            Instant.now().toString(),
            nullSafe(properties.activeEnv(), "unknown"),
            details
        );
    }

    private static String nullSafe(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value;
    }
}
