package com.cloudxplorer.authservice.domain.model;

public record IdentityAuthResult(
    IdentityUser user,
    IdentityTokens tokens
) {
}
