package com.cloudxplorer.authservice.api.dto.corpadmin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record CorpUserCreateRequest(
    @Email String email,
    @NotEmpty List<String> roleIds,
    String department,
    String managerId
) {
}
