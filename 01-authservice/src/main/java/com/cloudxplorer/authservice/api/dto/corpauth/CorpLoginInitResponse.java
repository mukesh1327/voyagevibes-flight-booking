package com.cloudxplorer.authservice.api.dto.corpauth;

import java.util.List;

public record CorpLoginInitResponse(
    String loginFlowId,
    List<String> allowedFactors,
    boolean requiresStepUp
) {
}
