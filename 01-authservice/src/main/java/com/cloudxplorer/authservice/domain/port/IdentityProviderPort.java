package com.cloudxplorer.authservice.domain.port;

import com.cloudxplorer.authservice.domain.model.IdentityAuthResult;
import com.cloudxplorer.authservice.domain.model.IdentityTokens;

public interface IdentityProviderPort {
    IdentityAuthResult exchangePublicGoogleCode(String code, String codeVerifier);

    IdentityTokens refresh(String refreshToken);

    void logout(String refreshToken);
}
