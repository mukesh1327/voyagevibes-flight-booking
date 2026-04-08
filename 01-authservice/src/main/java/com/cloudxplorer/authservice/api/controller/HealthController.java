package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.PublicAuthApi;
import com.cloudxplorer.authservice.api.dto.health.HealthResponse;
import com.cloudxplorer.authservice.infrastructure.config.AuthServiceProperties;
import com.cloudxplorer.authservice.infrastructure.health.DependencyHealthChecker;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
@Tag(name = "Health", description = "Liveness and readiness endpoints for authservice and its dependencies.")
public class HealthController {

    private final AuthServiceProperties properties;
    private final DependencyHealthChecker dependencyHealthChecker;

    public HealthController(AuthServiceProperties properties, DependencyHealthChecker dependencyHealthChecker) {
        this.properties = properties;
        this.dependencyHealthChecker = dependencyHealthChecker;
    }

    @Operation(summary = "Dependency-aware health", description = "Reports service health and validates both Keycloak and database connectivity.")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Service and dependencies are healthy",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = HealthResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.HEALTH_RESPONSE)
            )
        ),
        @ApiResponse(
            responseCode = "503",
            description = "One or more dependencies are unavailable",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = HealthResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.HEALTH_RESPONSE)
            )
        )
    })
    @GetMapping
    public ResponseEntity<HealthResponse> health() {
        return buildDependencyAwareHealth("health");
    }

    @Operation(summary = "Readiness probe", description = "Reports readiness and validates external dependencies before traffic should be routed to the service.")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Service is ready",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = HealthResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.HEALTH_RESPONSE)
            )
        ),
        @ApiResponse(
            responseCode = "503",
            description = "Service is not ready",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = HealthResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.HEALTH_RESPONSE)
            )
        )
    })
    @GetMapping("/ready")
    public ResponseEntity<HealthResponse> readiness() {
        return buildDependencyAwareHealth("readiness");
    }

    @Operation(summary = "Liveness probe", description = "Returns process liveness without dependency checks.")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Service process is live",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = HealthResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.HEALTH_RESPONSE)
            )
        )
    })
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