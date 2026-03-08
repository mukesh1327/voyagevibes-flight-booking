package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.CorpUserAdminApi;
import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserCreateRequest;
import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserUpdateRequest;
import com.cloudxplorer.authservice.api.dto.corpadmin.RoleAssignmentRequest;
import com.cloudxplorer.authservice.application.service.AuthApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CorpUserAdminController implements CorpUserAdminApi {

    private final AuthApplicationService service;

    public CorpUserAdminController(AuthApplicationService service) {
        this.service = service;
    }

    @Override
    public ResponseEntity<Void> createCorpUser(@Valid @RequestBody CorpUserCreateRequest request) {
        service.createCorpUser(request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateCorpUser(String id, @Valid @RequestBody CorpUserUpdateRequest request) {
        service.updateCorpUser(id, request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> enableCorpUser(String id) {
        service.enableCorpUser(id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> disableCorpUser(String id) {
        service.disableCorpUser(id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> assignRole(String id, @Valid @RequestBody RoleAssignmentRequest request) {
        service.assignRole(id, request.roleId());
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> removeRole(String id, String roleId) {
        service.removeRole(id, roleId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> forceMfaReset(String id) {
        service.forceMfaReset(id);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> revokeAllSessions(String id) {
        service.revokeAllSessionsForUser(id);
        return ResponseEntity.noContent().build();
    }
}
