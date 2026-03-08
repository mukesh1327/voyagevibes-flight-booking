package com.cloudxplorer.authservice.api.dto.publicauth;

import jakarta.validation.constraints.NotBlank;

public record OtpRequest(
    @NotBlank String purpose,
    @NotBlank String channel,
    @NotBlank String emailOrPhone
) {
}
