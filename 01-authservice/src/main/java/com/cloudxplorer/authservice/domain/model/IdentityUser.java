package com.cloudxplorer.authservice.domain.model;

import java.util.List;

public record IdentityUser(
    String providerUserId,
    String email,
    String firstName,
    String lastName,
    String mobile,
    String realm,
    List<String> roles
) {
}
