package com.cloudxplorer.authservice.api.dto.corpauth;

import com.cloudxplorer.authservice.api.dto.publicauth.AuthSessionResponse;
import java.util.Map;

public record CorpLoginVerifyResponse(
    AuthSessionResponse session,
    boolean challengeRequired,
    String challengeType,
    Map<String, Object> challengeMetadata
) {
}
