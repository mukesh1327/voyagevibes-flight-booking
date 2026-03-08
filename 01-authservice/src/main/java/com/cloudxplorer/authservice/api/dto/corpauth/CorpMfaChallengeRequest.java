package com.cloudxplorer.authservice.api.dto.corpauth;

import jakarta.validation.constraints.NotBlank;

public record CorpMfaChallengeRequest(
    @NotBlank String loginFlowId,
    @NotBlank String factorType
) {
}
