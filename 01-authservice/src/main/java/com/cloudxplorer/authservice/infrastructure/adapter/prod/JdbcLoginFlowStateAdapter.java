package com.cloudxplorer.authservice.infrastructure.adapter.prod;

import com.cloudxplorer.authservice.domain.model.LoginFlowState;
import com.cloudxplorer.authservice.domain.port.LoginFlowStatePort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.util.List;

@Component
public class JdbcLoginFlowStateAdapter implements LoginFlowStatePort {

    private final JdbcTemplate jdbcTemplate;

    public JdbcLoginFlowStateAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void save(LoginFlowState state) {
        jdbcTemplate.update(
            """
                INSERT INTO auth.login_flow_state(state, code_verifier, expires_at)
                VALUES (?, ?, ?)
                ON CONFLICT (state) DO UPDATE
                SET code_verifier = EXCLUDED.code_verifier,
                    expires_at = EXCLUDED.expires_at
                """,
            state.state(),
            state.codeVerifier(),
            Timestamp.from(state.expiresAt())
        );
    }

    @Override
    public LoginFlowState consume(String state) {
        List<LoginFlowState> rows = jdbcTemplate.query(
            """
                DELETE FROM auth.login_flow_state
                WHERE state = ?
                RETURNING state, code_verifier, expires_at
                """,
            (rs, rowNum) -> new LoginFlowState(
                rs.getString("state"),
                rs.getString("code_verifier"),
                rs.getTimestamp("expires_at").toInstant()
            ),
            state
        );
        return rows.isEmpty() ? null : rows.get(0);
    }
}
