package com.cloudxplorer.authservice.domain.port;

import com.cloudxplorer.authservice.domain.model.IdentityTokens;
import com.cloudxplorer.authservice.domain.model.UserSession;
import java.util.List;

public interface SessionPort {
    UserSession create(String userId, String device, String ip, String riskLevel, IdentityTokens tokens);

    List<UserSession> getByUserId(String userId);

    void revoke(String userId, String sessionId);

    void revokeAll(String userId);
}
