package com.cloudxplorer.authservice.api.dto.publicauth;

import jakarta.validation.constraints.NotBlank;

public record OtpVerifyRequest(
    @NotBlank String challengeId,
    @NotBlank String otp
) {
}
