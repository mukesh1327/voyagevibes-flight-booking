package com.cloudxplorer.authservice.api.dto.corpauth;

import jakarta.validation.constraints.NotBlank;

public record CorpMfaVerifyRequest(
    @NotBlank String challengeId,
    @NotBlank String otpOrAssertion
) {
}
