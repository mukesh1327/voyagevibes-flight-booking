package com.cloudxplorer.authservice.api.dto.corpadmin;

import jakarta.validation.constraints.NotBlank;

public record RoleAssignmentRequest(@NotBlank String roleId) {
}
