package com.cloudxplorer.authservice.domain.port;

import java.util.Map;

public interface AuditEventPort {
    void record(String actorUserId, String eventType, Map<String, Object> payload);
}
