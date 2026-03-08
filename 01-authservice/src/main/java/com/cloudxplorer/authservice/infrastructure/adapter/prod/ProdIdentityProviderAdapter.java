package com.cloudxplorer.authservice.infrastructure.adapter.prod;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cloudxplorer.authservice.domain.model.IdentityAuthResult;
import com.cloudxplorer.authservice.domain.model.IdentityTokens;
import com.cloudxplorer.authservice.domain.model.IdentityUser;
import com.cloudxplorer.authservice.domain.port.IdentityProviderPort;
import com.cloudxplorer.authservice.exception.BadRequestException;
import com.cloudxplorer.authservice.exception.ConfigurationException;
import com.cloudxplorer.authservice.exception.ExternalServiceException;
import com.cloudxplorer.authservice.infrastructure.config.AuthServiceProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Base64;
import java.util.Collections;

@Component
@Profile("prod")
public class ProdIdentityProviderAdapter implements IdentityProviderPort {
    private static final Logger log = LoggerFactory.getLogger(ProdIdentityProviderAdapter.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final AuthServiceProperties properties;

    public ProdIdentityProviderAdapter(RestClient restClient, AuthServiceProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    @PostConstruct
    void validateConfig() {
        if (properties.prodStrictConfig()) {
            require(properties.keycloak().baseUrl(), "KEYCLOAK_BASE_URL");
            require(properties.publicClient().realm(), "KEYCLOAK_PUBLIC_REALM");
            require(properties.publicClient().clientId(), "KEYCLOAK_CLIENT_ID_PUBLIC");
            require(properties.publicClient().redirectUri(), "PUBLIC_REDIRECT_URI");
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public IdentityAuthResult exchangePublicGoogleCode(String code, String codeVerifier) {
        if (code == null || code.isBlank() || codeVerifier == null || codeVerifier.isBlank()) {
            throw new BadRequestException("AUTH_CODE_INVALID", "Authorization code or code verifier is missing");
        }

        Map<String, Object> tokenBody = postToken(Map.of(
            "grant_type", "authorization_code",
            "client_id", properties.publicClient().clientId(),
            "client_secret", nullSafe(properties.publicClient().clientSecret()),
            "redirect_uri", properties.publicClient().redirectUri(),
            "code", code,
            "code_verifier", codeVerifier
        ));

        String accessToken = (String) tokenBody.getOrDefault("access_token", "");
        String refreshToken = (String) tokenBody.getOrDefault("refresh_token", "");
        String idToken = (String) tokenBody.getOrDefault("id_token", "");
        long expiresIn = asLong(tokenBody.getOrDefault("expires_in", 900));
        Map<String, Object> fallbackClaims = parseJwtClaims(idToken.isBlank() ? accessToken : idToken);

        Map<String, Object> userInfo = fallbackClaims;
        if (!hasEssentialClaims(userInfo)) {
            try {
                userInfo = restClient.get()
                    .uri(tokenBaseUrl().replace("/token", "/userinfo"))
                    .headers(headers -> headers.setBearerAuth(accessToken))
                    .retrieve()
                    .body(Map.class);
            } catch (RestClientResponseException ex) {
                log.error("Keycloak userinfo request failed: status={}, body={}", ex.getStatusCode(), ex.getResponseBodyAsString(), ex);
                throw new ExternalServiceException(
                    "KEYCLOAK_USERINFO_FAILED",
                    "Unable to fetch user info from identity provider: Keycloak /userinfo returned " + ex.getStatusCode().value(),
                    ex
                );
            } catch (RestClientException ex) {
                log.error("Keycloak userinfo request failed", ex);
                throw new ExternalServiceException("KEYCLOAK_USERINFO_FAILED", "Unable to fetch user info from identity provider", ex);
            }
        } else {
            log.info("Using JWT claims for public Google login profile enrichment");
        }

        String email = userInfo == null ? null : Objects.toString(userInfo.get("email"), "");
        String firstName = userInfo == null ? "" : Objects.toString(userInfo.get("given_name"), "");
        String lastName = userInfo == null ? "" : Objects.toString(userInfo.get("family_name"), "");
        String mobile = userInfo == null ? "" : firstNonBlank(
            userInfo.get("phone_number"),
            userInfo.get("phoneNumber")
        );
        String sub = userInfo == null ? "" : Objects.toString(userInfo.get("sub"), "");

        IdentityUser user = new IdentityUser(sub, email, firstName, lastName, mobile, "PUBLIC", List.of("CUSTOMER"));
        return new IdentityAuthResult(user, new IdentityTokens(accessToken, refreshToken, expiresIn));
    }

    @Override
    public IdentityTokens refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BadRequestException("REFRESH_TOKEN_MISSING", "Refresh token is required");
        }

        Map<String, Object> body = postToken(Map.of(
            "grant_type", "refresh_token",
            "client_id", properties.publicClient().clientId(),
            "client_secret", nullSafe(properties.publicClient().clientSecret()),
            "refresh_token", refreshToken
        ));
        return new IdentityTokens(
            Objects.toString(body.get("access_token"), ""),
            Objects.toString(body.get("refresh_token"), ""),
            asLong(body.getOrDefault("expires_in", 900))
        );
    }

    @Override
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BadRequestException("REFRESH_TOKEN_MISSING", "Refresh token is required");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", properties.publicClient().clientId());
        if (properties.publicClient().clientSecret() != null && !properties.publicClient().clientSecret().isBlank()) {
            form.add("client_secret", properties.publicClient().clientSecret());
        }
        form.add("refresh_token", refreshToken);

        try {
            restClient.post()
                .uri(tokenBaseUrl().replace("/token", "/logout"))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException ex) {
            throw new ExternalServiceException("KEYCLOAK_LOGOUT_FAILED", "Unable to logout from identity provider", ex);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postToken(Map<String, String> params) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        params.forEach((key, value) -> {
            if (value != null && !value.isBlank()) {
                form.add(key, value);
            }
        });

        try {
            return restClient.post()
                .uri(tokenBaseUrl())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(Map.class);
        } catch (RestClientResponseException ex) {
            log.error("Keycloak token exchange failed: status={}, body={}", ex.getStatusCode(), ex.getResponseBodyAsString(), ex);
            throw new ExternalServiceException(
                "KEYCLOAK_TOKEN_EXCHANGE_FAILED",
                "Unable to exchange token with identity provider: Keycloak token endpoint returned " + ex.getStatusCode().value(),
                ex
            );
        } catch (RestClientException ex) {
            log.error("Keycloak token exchange failed", ex);
            throw new ExternalServiceException("KEYCLOAK_TOKEN_EXCHANGE_FAILED", "Unable to exchange token with identity provider", ex);
        }
    }

    private String tokenBaseUrl() {
        return properties.keycloak().baseUrl() + "/realms/" + properties.publicClient().realm() + "/protocol/openid-connect/token";
    }

    private static void require(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ConfigurationException("CONFIG_MISSING", "Missing required config: " + name);
        }
    }

    private static long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(Objects.toString(value, "900"));
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private Map<String, Object> parseJwtClaims(String token) {
        if (token == null || token.isBlank()) {
            return Collections.emptyMap();
        }

        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                return Collections.emptyMap();
            }

            byte[] decoded = Base64.getUrlDecoder().decode(parts[1]);
            return OBJECT_MAPPER.readValue(decoded, new TypeReference<>() {});
        } catch (Exception ex) {
            log.warn("Unable to parse JWT claims for fallback", ex);
            return Collections.emptyMap();
        }
    }

    private boolean hasEssentialClaims(Map<String, Object> claims) {
        if (claims == null || claims.isEmpty()) {
            return false;
        }

        String sub = Objects.toString(claims.get("sub"), "");
        String email = Objects.toString(claims.get("email"), "");
        return !sub.isBlank() && !email.isBlank();
    }

    private static String firstNonBlank(Object... values) {
        for (Object value : values) {
            String text = Objects.toString(value, "").trim();
            if (!text.isBlank()) {
                return text;
            }
        }
        return "";
    }
}
