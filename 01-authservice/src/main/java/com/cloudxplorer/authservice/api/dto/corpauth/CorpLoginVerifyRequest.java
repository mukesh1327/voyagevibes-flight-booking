package com.cloudxplorer.authservice.api.dto.corpauth;

import jakarta.validation.constraints.NotBlank;

public record CorpLoginVerifyRequest(
    @NotBlank String loginFlowId,
    @NotBlank String factorType,
    @NotBlank String assertion
) {
}
