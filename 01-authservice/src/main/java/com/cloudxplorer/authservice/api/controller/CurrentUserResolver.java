package com.cloudxplorer.authservice.api.controller;

// import com.cloudxplorer.authservice.application.service.AuthApplicationService;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserResolver {

    public String resolveUserId(String userIdHeader) {
        if (userIdHeader == null || userIdHeader.isBlank()) {
            return "dev-user";
        }
        return userIdHeader;
    }
}
