package com.cloudxplorer.authservice.infrastructure.adapter.dev;

import com.cloudxplorer.authservice.domain.model.IdentityAuthResult;
import com.cloudxplorer.authservice.domain.model.IdentityTokens;
import com.cloudxplorer.authservice.domain.model.IdentityUser;
import com.cloudxplorer.authservice.domain.port.IdentityProviderPort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Component
@Profile("dev")
public class DevIdentityProviderAdapter implements IdentityProviderPort {

    @Override
    public IdentityAuthResult exchangePublicGoogleCode(String code, String codeVerifier) {
        String seed = code == null || code.isBlank() ? UUID.randomUUID().toString() : code;
        IdentityUser user = new IdentityUser(
            "google-" + seed,
            "customer@example.com",
            "Dev",
            "Customer",
            "+910000000000",
            "PUBLIC",
            List.of("CUSTOMER")
        );
        IdentityTokens tokens = new IdentityTokens(randomToken(), randomToken(), 900);
        return new IdentityAuthResult(user, tokens);
    }

    @Override
    public IdentityTokens refresh(String refreshToken) {
        return new IdentityTokens(randomToken(), randomToken(), 900);
    }

    @Override
    public void logout(String refreshToken) {
        // No-op in dev mock implementation.
    }

    private static String randomToken() {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(UUID.randomUUID().toString().getBytes());
    }
}
