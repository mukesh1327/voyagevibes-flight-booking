package in.cloudxplorer.authservice.model;

public record KeycloakUserProfile(
        String subject,
        String username,
        String email,
        String fullName,
        String givenName,
        String familyName,
        boolean emailVerified,
        String identityProvider,
        String issuer
) {
}
