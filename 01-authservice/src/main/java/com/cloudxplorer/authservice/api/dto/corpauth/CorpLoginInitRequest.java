package com.cloudxplorer.authservice.api.dto.corpauth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;

public record CorpLoginInitRequest(
    @Email String email,
    @NotNull DeviceInfo deviceInfo
) {
}
