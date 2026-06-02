package in.cloudxplorer.authservice.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springdoc.core.models.GroupedOpenApi;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "Flight Booking Authentication Service",
                version = "v1",
                description = "Authentication service for customer and corporate users backed by Keycloak.",
                contact = @Contact(name = "Platform Engineering")
        ),
        servers = @Server(url = "/", description = "Current environment")
)
@SecurityScheme(
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT"
)
public class OpenApiConfig {

    @Bean
    public GroupedOpenApi customerOpenApi() {
        return GroupedOpenApi.builder()
                .group("customer")
                .pathsToMatch("/auth/customer/**", "/auth/me", "/auth/frontend-config")
                .addOpenApiCustomizer(openApi -> openApi.info(new io.swagger.v3.oas.models.info.Info()
                        .title("Flight Booking Customer Authentication API")
                        .version("v1")
                        .description("Customer onboarding, login, logout, and self-service identity endpoints.")))
                .build();
    }

    @Bean
    public GroupedOpenApi corporateOpenApi() {
        return GroupedOpenApi.builder()
                .group("corporate")
                .pathsToMatch("/auth/corporate/**", "/auth/me", "/auth/frontend-config")
                .addOpenApiCustomizer(openApi -> openApi.info(new io.swagger.v3.oas.models.info.Info()
                        .title("Flight Booking Corporate Authentication API")
                        .version("v1")
                        .description("Corporate workforce login and token-driven identity endpoints.")))
                .build();
    }

    @Bean
    public GroupedOpenApi operationsOpenApi() {
        return GroupedOpenApi.builder()
                .group("operations")
                .pathsToMatch("/health", "/actuator/health/**")
                .addOpenApiCustomizer(openApi -> openApi.info(new io.swagger.v3.oas.models.info.Info()
                        .title("Flight Booking Operations API")
                        .version("v1")
                        .description("Operational health, readiness, and liveness endpoints.")))
                .build();
    }
}
