package com.cloudxplorer.authservice.api.dto.corpadmin;

public record CorpUserUpdateRequest(
    String status,
    String department,
    String managerId
) {
}
