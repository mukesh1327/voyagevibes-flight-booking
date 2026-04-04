package com.cloudxplorer.authservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "authservice")
public record AuthServiceProperties(
    String activeEnv,
    String hostname,
    String appBaseUrl,
    boolean prodStrictConfig,
    KeycloakProperties keycloak,
    PublicClientProperties publicClient,
    CorpClientProperties corp
) {
    public record KeycloakProperties(String baseUrl, String publicBaseUrl) {
    }

    public record PublicClientProperties(
        String realm,
        String clientId,
        String clientSecret,
        String redirectUri,
        String googleIdpAlias
    ) {
    }

    public record CorpClientProperties(
        String realm,
        String clientId,
        String clientSecret,
        String redirectUri
    ) {
    }
}
