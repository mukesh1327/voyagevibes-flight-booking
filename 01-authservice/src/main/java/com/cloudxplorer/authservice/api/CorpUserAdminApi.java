package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserCreateRequest;
import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserUpdateRequest;
import com.cloudxplorer.authservice.api.dto.corpadmin.RoleAssignmentRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@Tag(name = "Corporate User Admin", description = "Corporate workforce provisioning and account control endpoints.")
public interface CorpUserAdminApi {
    @Operation(summary = "Create corporate user", description = "Creates a new workforce user with initial role assignments.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = CorpUserCreateRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.CORP_USER_CREATE_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Corporate user created")
    })
    @PostMapping("/api/v1/corp/users")
    ResponseEntity<Void> createCorpUser(@Valid @RequestBody CorpUserCreateRequest request);

    @Operation(summary = "Update corporate user", description = "Updates status or reporting metadata for an existing workforce user.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = CorpUserUpdateRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.CORP_USER_UPDATE_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Corporate user updated")
    })
    @PatchMapping("/api/v1/corp/users/{id}")
    ResponseEntity<Void> updateCorpUser(
        @Parameter(in = ParameterIn.PATH, description = "Corporate user identifier.", example = "corp-user-2001")
        @PathVariable("id") String id,
        @Valid @RequestBody CorpUserUpdateRequest request
    );

    @Operation(summary = "Enable corporate user", description = "Sets the workforce user status to ACTIVE.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Corporate user enabled")
    })
    @PostMapping("/api/v1/corp/users/{id}/enable")
    ResponseEntity<Void> enableCorpUser(
        @Parameter(in = ParameterIn.PATH, description = "Corporate user identifier.", example = "corp-user-2001")
        @PathVariable("id") String id
    );

    @Operation(summary = "Disable corporate user", description = "Sets the workforce user status to DISABLED and revokes active sessions.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Corporate user disabled")
    })
    @PostMapping("/api/v1/corp/users/{id}/disable")
    ResponseEntity<Void> disableCorpUser(
        @Parameter(in = ParameterIn.PATH, description = "Corporate user identifier.", example = "corp-user-2001")
        @PathVariable("id") String id
    );

    @Operation(summary = "Assign corporate role", description = "Assigns an additional role to the workforce user.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = RoleAssignmentRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.ROLE_ASSIGNMENT_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Role assigned")
    })
    @PostMapping("/api/v1/corp/users/{id}/roles")
    ResponseEntity<Void> assignRole(
        @Parameter(in = ParameterIn.PATH, description = "Corporate user identifier.", example = "corp-user-2001")
        @PathVariable("id") String id,
        @Valid @RequestBody RoleAssignmentRequest request
    );

    @Operation(summary = "Remove corporate role", description = "Removes one assigned role from the workforce user.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Role removed")
    })
    @DeleteMapping("/api/v1/corp/users/{id}/roles/{roleId}")
    ResponseEntity<Void> removeRole(
        @Parameter(in = ParameterIn.PATH, description = "Corporate user identifier.", example = "corp-user-2001")
        @PathVariable("id") String id,
        @Parameter(in = ParameterIn.PATH, description = "Role identifier to remove.", example = "FINANCE_AGENT")
        @PathVariable("roleId") String roleId
    );

    @Operation(summary = "Force MFA reset", description = "Forces the workforce user to re-enroll their MFA factors.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "MFA reset requested")
    })
    @PostMapping("/api/v1/corp/users/{id}/force-mfa-reset")
    ResponseEntity<Void> forceMfaReset(
        @Parameter(in = ParameterIn.PATH, description = "Corporate user identifier.", example = "corp-user-2001")
        @PathVariable("id") String id
    );

    @Operation(summary = "Revoke all user sessions", description = "Revokes all active sessions for the selected workforce user.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "All sessions revoked")
    })
    @PostMapping("/api/v1/corp/users/{id}/session-revoke")
    ResponseEntity<Void> revokeAllSessions(
        @Parameter(in = ParameterIn.PATH, description = "Corporate user identifier.", example = "corp-user-2001")
        @PathVariable("id") String id
    );
}