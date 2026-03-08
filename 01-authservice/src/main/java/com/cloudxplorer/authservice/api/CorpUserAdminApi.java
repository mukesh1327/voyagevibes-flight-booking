package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserCreateRequest;
import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserUpdateRequest;
import com.cloudxplorer.authservice.api.dto.corpadmin.RoleAssignmentRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

public interface CorpUserAdminApi {
    @PostMapping("/api/v1/corp/users")
    ResponseEntity<Void> createCorpUser(@Valid @RequestBody CorpUserCreateRequest request);

    @PatchMapping("/api/v1/corp/users/{id}")
    ResponseEntity<Void> updateCorpUser(@PathVariable("id") String id, @Valid @RequestBody CorpUserUpdateRequest request);

    @PostMapping("/api/v1/corp/users/{id}/enable")
    ResponseEntity<Void> enableCorpUser(@PathVariable("id") String id);

    @PostMapping("/api/v1/corp/users/{id}/disable")
    ResponseEntity<Void> disableCorpUser(@PathVariable("id") String id);

    @PostMapping("/api/v1/corp/users/{id}/roles")
    ResponseEntity<Void> assignRole(@PathVariable("id") String id, @Valid @RequestBody RoleAssignmentRequest request);

    @DeleteMapping("/api/v1/corp/users/{id}/roles/{roleId}")
    ResponseEntity<Void> removeRole(@PathVariable("id") String id, @PathVariable("roleId") String roleId);

    @PostMapping("/api/v1/corp/users/{id}/force-mfa-reset")
    ResponseEntity<Void> forceMfaReset(@PathVariable("id") String id);

    @PostMapping("/api/v1/corp/users/{id}/session-revoke")
    ResponseEntity<Void> revokeAllSessions(@PathVariable("id") String id);
}
