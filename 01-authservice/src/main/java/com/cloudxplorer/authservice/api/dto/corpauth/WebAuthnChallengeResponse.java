package com.cloudxplorer.authservice.api.dto.corpauth;

public record WebAuthnChallengeResponse(
    String challenge,
    String rpId,
    long timeout
) {
}
