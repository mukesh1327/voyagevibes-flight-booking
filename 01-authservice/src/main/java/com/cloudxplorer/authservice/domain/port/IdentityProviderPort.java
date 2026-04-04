package com.cloudxplorer.authservice.domain.port;

import com.cloudxplorer.authservice.domain.model.IdentityAuthResult;
import com.cloudxplorer.authservice.domain.model.IdentityTokens;

public interface IdentityProviderPort {
    IdentityAuthResult exchangePublicGoogleCode(String code, String codeVerifier);

    IdentityAuthResult exchangeCorpPassword(String username, String password);

    IdentityTokens refresh(String refreshToken);

    void logout(String refreshToken);
}
