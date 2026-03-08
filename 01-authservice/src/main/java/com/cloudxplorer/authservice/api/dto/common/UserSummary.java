package com.cloudxplorer.authservice.api.dto.common;

import java.util.List;

public record UserSummary(
    String userId,
    String email,
    String realm,
    String status,
    List<String> roles
) {
}
