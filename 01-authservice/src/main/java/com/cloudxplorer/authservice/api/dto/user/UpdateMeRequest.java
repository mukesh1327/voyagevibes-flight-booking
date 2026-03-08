package com.cloudxplorer.authservice.api.dto.user;

import jakarta.validation.constraints.Size;
import java.util.Map;

public record UpdateMeRequest(
    @Size(max = 100) String firstName,
    @Size(max = 100) String lastName,
    @Size(max = 20) String mobile,
    Map<String, Object> preferences
) {
}
