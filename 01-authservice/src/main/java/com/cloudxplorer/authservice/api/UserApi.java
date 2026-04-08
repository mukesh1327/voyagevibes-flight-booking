package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.user.MeResponse;
import com.cloudxplorer.authservice.api.dto.user.UpdateMeRequest;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@Tag(name = "Users", description = "Current-user profile lookup and update endpoints.")
public interface UserApi {
    @Operation(summary = "Get current user profile", description = "Returns the merged identity and profile view for the resolved current user.")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Profile returned",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = MeResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.ME_RESPONSE)
            )
        )
    })
    @GetMapping("/api/v1/users/me")
    ResponseEntity<MeResponse> getMe(
        @Parameter(in = ParameterIn.HEADER, description = "Current user identifier resolved by the authservice.", example = "user-public-1001")
        @RequestHeader(value = "X-User-Id", required = false) String userId
    );

    @Operation(summary = "Update current user profile", description = "Updates mutable profile fields for the resolved current user.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = UpdateMeRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.UPDATE_ME_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Profile updated",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = MeResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.ME_RESPONSE)
            )
        )
    })
    @PatchMapping("/api/v1/users/me")
    ResponseEntity<MeResponse> updateMe(
        @Parameter(in = ParameterIn.HEADER, description = "Current user identifier resolved by the authservice.", example = "user-public-1001")
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody UpdateMeRequest request
    );
}