package in.cloudxplorer.authservice.controller;

import in.cloudxplorer.authservice.health.KeycloakHealthIndicator;
import in.cloudxplorer.authservice.web.HealthResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.boot.actuate.jdbc.DataSourceHealthIndicator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Operational", description = "Operational and health endpoints.")
public class HealthController {

    private final DataSourceHealthIndicator dataSourceHealthIndicator;
    private final KeycloakHealthIndicator keycloakHealthIndicator;

    @Value("${spring.application.name}")
    private String serviceName;

    @Value("${server.port}")
    private int port;

    public HealthController(DataSource dataSource, KeycloakHealthIndicator keycloakHealthIndicator) {
        this.dataSourceHealthIndicator = new DataSourceHealthIndicator(dataSource);
        this.keycloakHealthIndicator = keycloakHealthIndicator;
    }

    @GetMapping("/health")
    @Operation(summary = "Operational health endpoint that is UP only when DB and Keycloak are reachable")
    public ResponseEntity<HealthResponse> health() {
        Health dbHealth = dataSourceHealthIndicator.health();
        Health keycloakHealth = keycloakHealthIndicator.health();
        boolean operational = Status.UP.equals(dbHealth.getStatus())
                && Status.UP.equals(keycloakHealth.getStatus());

        HealthResponse response = new HealthResponse(
                operational ? "UP" : "DOWN",
                serviceName,
                port,
                operational,
                Map.of(
                        "db", dbHealth.getStatus().getCode(),
                        "keycloak", keycloakHealth.getStatus().getCode()
                )
        );
        return ResponseEntity.status(operational ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }
}
