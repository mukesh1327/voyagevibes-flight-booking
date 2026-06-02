package in.cloudxplorer.authservice.model;

import java.util.Set;

public record KeycloakSession(
        String accessToken,
        String refreshToken,
        String idToken,
        String tokenType,
        long expiresIn,
        String scope,
        KeycloakUserProfile userProfile,
        Set<String> roles,
        boolean tokenActive
) {
}
