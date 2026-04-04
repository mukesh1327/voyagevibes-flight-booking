package com.cloudxplorer.authservice.infrastructure.adapter.prod;

import com.cloudxplorer.authservice.domain.model.IdentityTokens;
import com.cloudxplorer.authservice.domain.model.UserSession;
import com.cloudxplorer.authservice.domain.port.SessionPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class JdbcSessionAdapter implements SessionPort {

    private final JdbcTemplate jdbcTemplate;

    public JdbcSessionAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public UserSession create(String userId, String device, String ip, String riskLevel, IdentityTokens tokens) {
        UserSession session = new UserSession(
            "sess_" + UUID.randomUUID(),
            userId,
            device == null ? "web" : device,
            ip == null ? "unknown" : ip,
            Instant.now(),
            Instant.now(),
            riskLevel
        );

        jdbcTemplate.update(
            """
                INSERT INTO auth.user_session
                    (session_id, user_id, device, ip, risk_level, created_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
            session.sessionId(),
            session.userId(),
            session.device(),
            session.ip(),
            session.riskLevel(),
            Timestamp.from(session.createdAt()),
            Timestamp.from(session.lastSeenAt())
        );

        return session;
    }

    @Override
    public List<UserSession> getByUserId(String userId) {
        return jdbcTemplate.query(
            """
                SELECT session_id, user_id, device, ip, risk_level, created_at, last_seen_at
                FROM auth.user_session
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
            (rs, rowNum) -> mapRow(rs),
            userId
        );
    }

    @Override
    public void revoke(String userId, String sessionId) {
        jdbcTemplate.update(
            "DELETE FROM auth.user_session WHERE user_id = ? AND session_id = ?",
            userId, sessionId
        );
    }

    @Override
    public void revokeAll(String userId) {
        jdbcTemplate.update("DELETE FROM auth.user_session WHERE user_id = ?", userId);
    }

    private static UserSession mapRow(ResultSet rs) throws SQLException {
        return new UserSession(
            rs.getString("session_id"),
            rs.getString("user_id"),
            rs.getString("device"),
            rs.getString("ip"),
            rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("last_seen_at").toInstant(),
            rs.getString("risk_level")
        );
    }
}
