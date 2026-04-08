package com.cloudxplorer.authservice.infrastructure.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableConfigurationProperties(AuthServiceProperties.class)
public class AuthServiceConfig {

    @Bean
    public RestClient restClient() {
        return RestClient.builder().build();
    }

    @Bean
    public OpenAPI authServiceOpenApi(AuthServiceProperties properties) {
        List<Server> servers = new ArrayList<>();
        servers.add(new Server()
            .url("/")
            .description("Relative server URL"));

        String appBaseUrl = properties.appBaseUrl();
        if (appBaseUrl != null && !appBaseUrl.isBlank()) {
            servers.add(new Server()
                .url(appBaseUrl)
                .description("Configured authservice base URL"));
        }

        return new OpenAPI()
            .info(new Info()
                .title("VoyageVibes Auth Service API")
                .version("v1")
                .description("OpenAPI documentation for authservice public auth, corporate auth, session, user, admin, and health endpoints.")
                .contact(new Contact()
                    .name("VoyageVibes Platform Team")
                    .email("platform@voyagevibes.local")))
            .components(new Components()
                .addSecuritySchemes("X-User-Id", new SecurityScheme()
                    .type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.HEADER)
                    .name("X-User-Id")
                    .description("Optional user header used by protected endpoints in local/dev and internal service calls.")))
            .servers(servers);
    }
}