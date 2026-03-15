package com.cloudxplorer.authservice.infrastructure.adapter.prod;

import com.cloudxplorer.authservice.domain.port.AuditEventPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;

@Component
public class JdbcAuditEventAdapter implements AuditEventPort {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final JdbcTemplate jdbcTemplate;

    public JdbcAuditEventAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void record(String actorUserId, String eventType, Map<String, Object> payload) {
        String jsonPayload = toJson(payload);
        PGobject jsonb = new PGobject();
        try {
            jsonb.setType("jsonb");
            jsonb.setValue(jsonPayload);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize audit payload", ex);
        }

        jdbcTemplate.update(
            """
                INSERT INTO auth.audit_event (actor_user_id, event_type, event_payload, created_at)
                VALUES (?, ?, ?, ?)
                """,
            actorUserId,
            eventType,
            jsonb,
            Timestamp.from(Instant.now())
        );
    }

    private static String toJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return "{}";
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }
}
