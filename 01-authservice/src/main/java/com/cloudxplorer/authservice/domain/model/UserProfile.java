package com.cloudxplorer.authservice.domain.model;

import java.time.Instant;
import java.util.List;

public record UserProfile(
    String userId,
    String email,
    String firstName,
    String lastName,
    String mobile,
    boolean mobileVerified,
    String realm,
    List<String> roles,
    String profileStatus,
    Instant updatedAt
) {
}
