package com.cloudxplorer.authservice.api.dto.user;

import java.util.List;

public record MeResponse(
    String userId,
    String email,
    String firstName,
    String lastName,
    String mobile,
    boolean mobileVerified,
    String realm,
    List<String> roles,
    String profileStatus
) {
}
