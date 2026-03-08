package com.cloudxplorer.authservice.api.dto.publicauth;

import com.cloudxplorer.authservice.api.dto.common.TokenPair;
import com.cloudxplorer.authservice.api.dto.common.UserSummary;

public record AuthSessionResponse(
    TokenPair tokens,
    UserSummary user,
    boolean isNewUser,
    String profileStatus,
    String mfaLevel
) {
}
