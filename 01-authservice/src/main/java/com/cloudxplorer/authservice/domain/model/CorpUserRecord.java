package com.cloudxplorer.authservice.domain.model;

import java.time.Instant;
import java.util.List;

public record CorpUserRecord(
    String userId,
    String email,
    String status,
    List<String> roles,
    String department,
    String managerId,
    Instant updatedAt
) {
}
