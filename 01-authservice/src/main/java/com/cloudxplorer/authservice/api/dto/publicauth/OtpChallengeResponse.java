package com.cloudxplorer.authservice.api.dto.publicauth;

public record OtpChallengeResponse(
    String challengeId,
    long expiresIn,
    long resendAfter
) {
}
