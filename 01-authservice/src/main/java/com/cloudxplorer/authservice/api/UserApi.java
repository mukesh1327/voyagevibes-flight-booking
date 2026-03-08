package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.user.MeResponse;
import com.cloudxplorer.authservice.api.dto.user.UpdateMeRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

public interface UserApi {
    @GetMapping("/api/v1/users/me")
    ResponseEntity<MeResponse> getMe(@RequestHeader(value = "X-User-Id", required = false) String userId);

    @PatchMapping("/api/v1/users/me")
    ResponseEntity<MeResponse> updateMe(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody UpdateMeRequest request
    );
}
