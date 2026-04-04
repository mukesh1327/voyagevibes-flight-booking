package com.cloudxplorer.authservice.api.dto.publicauth;

public record PublicGoogleStartResponse(
    String authorizationUrl,
    String state,
    String codeChallengeMethod,
    String codeVerifier
) {
}
