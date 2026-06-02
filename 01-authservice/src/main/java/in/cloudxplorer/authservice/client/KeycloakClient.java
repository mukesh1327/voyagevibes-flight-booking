package in.cloudxplorer.authservice.client;

import in.cloudxplorer.authservice.config.AuthServiceProperties;
import in.cloudxplorer.authservice.dto.AuthCodeExchangeRequest;
import in.cloudxplorer.authservice.exception.AuthServiceException;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import java.util.Objects;

@Component
public class KeycloakClient {

    private final RestClient restClient;
    private final AuthServiceProperties properties;

    public KeycloakClient(RestClient keycloakRestClient, AuthServiceProperties properties) {
        this.restClient = keycloakRestClient;
        this.properties = properties;
    }

    public TokenEndpointResponse exchangeAuthorizationCode(AuthCodeExchangeRequest request) {
        String redirectUri = properties.getKeycloak().resolveRedirectUri(request.redirectUri());
        if (!StringUtils.hasText(redirectUri)) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Redirect URI is required for authorization code exchange");
        }
        MultiValueMap<String, String> body = baseClientForm(
                properties.getKeycloak().getClientId(),
                properties.getKeycloak().getClientSecret()
        );
        body.add("grant_type", "authorization_code");
        body.add("code", request.authorizationCode());
        body.add("redirect_uri", redirectUri);
        if (StringUtils.hasText(request.codeVerifier())) {
            body.add("code_verifier", request.codeVerifier());
        }
        return postForm(properties.getKeycloak().tokenEndpoint(), body, TokenEndpointResponse.class, "Token exchange failed");
    }

    public Map<String, Object> fetchUserInfo(String accessToken) {
        String userInfoEndpoint = properties.getKeycloak().userInfoEndpoint();
        if (!StringUtils.hasText(userInfoEndpoint)) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "User info endpoint is required");
        }
        try {
            return restClient.get()
                    .uri(Objects.requireNonNull(userInfoEndpoint))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});
        } catch (RestClientResponseException ex) {
            throw new AuthServiceException(HttpStatus.UNAUTHORIZED, "Failed to fetch user info from Keycloak");
        }
    }

    public void logout(String refreshToken) {
        String logoutEndpoint = properties.getKeycloak().logoutEndpoint();
        if (!StringUtils.hasText(logoutEndpoint)) {
            throw new AuthServiceException(HttpStatus.BAD_REQUEST, "Logout endpoint is required");
        }
        logoutEndpoint = Objects.requireNonNull(logoutEndpoint);
        MultiValueMap<String, String> body = baseClientForm(
                properties.getKeycloak().getClientId(),
                properties.getKeycloak().getClientSecret()
        );
        body.add("refresh_token", refreshToken);
        try {
            restClient.post()
                    .uri(logoutEndpoint)
                    .contentType(Objects.requireNonNull(MediaType.APPLICATION_FORM_URLENCODED))
                    .body(Objects.requireNonNull(body))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
            if (status != null && status.is4xxClientError()) {
                throw new AuthServiceException(HttpStatus.UNAUTHORIZED, "Logout failed");
            }
            throw new AuthServiceException(HttpStatus.BAD_GATEWAY, "Logout failed");
        }
    }

    public Map<String, Object> introspect(String token) {
        requireConfidentialClient("Token introspection");
        MultiValueMap<String, String> body = baseClientForm(
                properties.getKeycloak().getAdminClientId(),
                properties.getKeycloak().getAdminClientSecret()
        );
        body.add("token", token);
        return postForm(
                properties.getKeycloak().introspectionEndpoint(),
                body,
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {},
                "Token introspection failed"
        );
    }

    public void deleteUser(String userId) {
        String adminAccessToken = getAdminAccessToken();
        try {
            restClient.delete()
                    .uri(properties.getKeycloak().adminUsersEndpoint() + "/" + userId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAccessToken)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
            if (status == HttpStatus.NOT_FOUND) {
                throw new AuthServiceException(HttpStatus.NOT_FOUND, "Customer not found in Keycloak");
            }
            throw new AuthServiceException(HttpStatus.BAD_GATEWAY, "Failed to delete user in Keycloak");
        }
    }

    private String getAdminAccessToken() {
        requireConfidentialClient("Keycloak admin access");
        MultiValueMap<String, String> body = baseClientForm(
                properties.getKeycloak().getAdminClientId(),
                properties.getKeycloak().getAdminClientSecret()
        );
        body.add("grant_type", "client_credentials");
        TokenEndpointResponse response = postForm(
                properties.getKeycloak().tokenEndpoint(),
                body,
                TokenEndpointResponse.class,
                "Failed to obtain Keycloak admin access token"
        );
        return response.accessToken();
    }

    private MultiValueMap<String, String> baseClientForm(String clientId, String clientSecret) {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", clientId);
        if (StringUtils.hasText(clientSecret)) {
            body.add("client_secret", clientSecret);
        }
        return body;
    }

    private void requireConfidentialClient(String capability) {
        if (!StringUtils.hasText(properties.getKeycloak().getAdminClientSecret())) {
            throw new AuthServiceException(
                    HttpStatus.PRECONDITION_FAILED,
                    capability + " requires a confidential Keycloak client with client secret"
            );
        }
    }

    private <T> T postForm(String url, MultiValueMap<String, String> body, Class<T> type, String failureMessage) {
        try {
            return restClient.post()
                    .uri(Objects.requireNonNull(url))
                    .contentType(Objects.requireNonNull(MediaType.APPLICATION_FORM_URLENCODED))
                    .body(Objects.requireNonNull(body))
                    .retrieve()
                    .body(Objects.requireNonNull(type));
        } catch (RestClientResponseException ex) {
            HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
            if (status != null && status.is4xxClientError()) {
                throw new AuthServiceException(HttpStatus.UNAUTHORIZED, failureMessage);
            }
            throw new AuthServiceException(HttpStatus.BAD_GATEWAY, failureMessage);
        }
    }

    private <T> T postForm(String url, MultiValueMap<String, String> body,
            org.springframework.core.ParameterizedTypeReference<T> type,
            String failureMessage) {
        try {
            return restClient.post()
                    .uri(Objects.requireNonNull(url))
                    .contentType(Objects.requireNonNull(MediaType.APPLICATION_FORM_URLENCODED))
                    .body(Objects.requireNonNull(body))
                    .retrieve()
                    .body(Objects.requireNonNull(type));
        } catch (RestClientResponseException ex) {
            HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
            if (status != null && status.is4xxClientError()) {
                throw new AuthServiceException(HttpStatus.UNAUTHORIZED, failureMessage);
            }
            throw new AuthServiceException(HttpStatus.BAD_GATEWAY, failureMessage);
        }
    }

    public record TokenEndpointResponse(
            String access_token,
            String refresh_token,
            String id_token,
            String token_type,
            long expires_in,
            String scope
    ) {
        public String accessToken() {
            return access_token;
        }

        public String refreshToken() {
            return refresh_token;
        }

        public String idToken() {
            return id_token;
        }

        public String tokenType() {
            return token_type;
        }

        public long expiresIn() {
            return expires_in;
        }
    }
}
