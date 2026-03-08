package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.UserApi;
import com.cloudxplorer.authservice.api.dto.user.MeResponse;
import com.cloudxplorer.authservice.api.dto.user.UpdateMeRequest;
import com.cloudxplorer.authservice.application.service.AuthApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController implements UserApi {

    private final AuthApplicationService service;
    private final CurrentUserResolver currentUserResolver;

    public UserController(AuthApplicationService service, CurrentUserResolver currentUserResolver) {
        this.service = service;
        this.currentUserResolver = currentUserResolver;
    }

    @Override
    public ResponseEntity<MeResponse> getMe(String userId) {
        return ResponseEntity.ok(service.getMe(currentUserResolver.resolveUserId(userId)));
    }

    @Override
    public ResponseEntity<MeResponse> updateMe(String userId, @Valid @RequestBody UpdateMeRequest request) {
        return ResponseEntity.ok(service.updateMe(currentUserResolver.resolveUserId(userId), request));
    }
}
