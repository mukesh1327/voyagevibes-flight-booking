package com.cloudxplorer.authservice.infrastructure.adapter.prod;

import com.cloudxplorer.authservice.domain.model.CorpUserRecord;
import com.cloudxplorer.authservice.domain.port.CorpUserAdminPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Component
public class JdbcCorpUserAdminAdapter implements CorpUserAdminPort {

    private static final String REALM_CORP = "CORP";
    private final JdbcTemplate jdbcTemplate;

    public JdbcCorpUserAdminAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public CorpUserRecord create(String email, List<String> roles, String department, String managerId) {
        CorpUserRecord existing = getByEmailAnyRealm(email);
        Instant now = Instant.now();
        String roleCsv = rolesToCsv(roles);

        if (existing != null) {
            String mergedRoles = rolesToCsv(mergeRoles(existing.roles(), roles));
            jdbcTemplate.update(
                """
                    UPDATE auth.user_profile
                    SET realm = ?,
                        roles_csv = ?,
                        account_status = 'ACTIVE',
                        department = ?,
                        manager_id = ?,
                        updated_at = ?
                    WHERE user_id = ?
                    """,
                REALM_CORP,
                mergedRoles,
                coalesce(department, existing.department()),
                coalesce(managerId, existing.managerId()),
                Timestamp.from(now),
                existing.userId()
            );
            return getById(existing.userId());
        }

        String userId = "corp_" + UUID.randomUUID().toString().replace("-", "");
        jdbcTemplate.update(
            """
                INSERT INTO auth.user_profile
                    (user_id, email, first_name, last_name, mobile, mobile_verified, realm, roles_csv, profile_status,
                     account_status, department, manager_id, updated_at)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
            userId,
            email,
            "",
            "",
            null,
            false,
            REALM_CORP,
            roleCsv,
            "INCOMPLETE",
            "ACTIVE",
            department,
            managerId,
            Timestamp.from(now)
        );

        return getById(userId);
    }

    @Override
    public CorpUserRecord update(String userId, String status, String department, String managerId) {
        CorpUserRecord existing = getById(userId);
        if (existing == null) {
            return null;
        }

        String nextStatus = normalizeStatus(coalesce(status, existing.status()));
        Instant now = Instant.now();

        jdbcTemplate.update(
            """
                UPDATE auth.user_profile
                SET account_status = ?,
                    department = ?,
                    manager_id = ?,
                    updated_at = ?
                WHERE user_id = ?
                """,
            nextStatus,
            coalesce(department, existing.department()),
            coalesce(managerId, existing.managerId()),
            Timestamp.from(now),
            userId
        );

        return getById(userId);
    }

    @Override
    public CorpUserRecord getById(String userId) {
        List<CorpUserRecord> rows = jdbcTemplate.query(
            """
                SELECT user_id, email, roles_csv, account_status, department, manager_id, updated_at
                FROM auth.user_profile
                WHERE user_id = ?
                  AND realm = ?
                """,
            (rs, rowNum) -> mapRow(rs),
            userId,
            REALM_CORP
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Override
    public CorpUserRecord getByEmail(String email) {
        List<CorpUserRecord> rows = jdbcTemplate.query(
            """
                SELECT user_id, email, roles_csv, account_status, department, manager_id, updated_at
                FROM auth.user_profile
                WHERE email = ?
                  AND realm = ?
                """,
            (rs, rowNum) -> mapRow(rs),
            email,
            REALM_CORP
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    private CorpUserRecord getByEmailAnyRealm(String email) {
        List<CorpUserRecord> rows = jdbcTemplate.query(
            """
                SELECT user_id, email, roles_csv, account_status, department, manager_id, updated_at
                FROM auth.user_profile
                WHERE email = ?
                """,
            (rs, rowNum) -> mapRow(rs),
            email
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Override
    public CorpUserRecord addRole(String userId, String roleId) {
        CorpUserRecord existing = getById(userId);
        if (existing == null) {
            return null;
        }

        List<String> nextRoles = mergeRoles(existing.roles(), List.of(roleId));
        updateRoles(userId, nextRoles);
        return getById(userId);
    }

    @Override
    public CorpUserRecord removeRole(String userId, String roleId) {
        CorpUserRecord existing = getById(userId);
        if (existing == null) {
            return null;
        }

        String normalized = normalizeRole(roleId);
        List<String> nextRoles = existing.roles().stream()
            .filter(role -> !role.equalsIgnoreCase(normalized))
            .toList();

        updateRoles(userId, nextRoles);
        return getById(userId);
    }

    @Override
    public void setStatus(String userId, String status) {
        String normalized = normalizeStatus(status);
        jdbcTemplate.update(
            """
                UPDATE auth.user_profile
                SET account_status = ?, updated_at = ?
                WHERE user_id = ?
                """,
            normalized,
            Timestamp.from(Instant.now()),
            userId
        );
    }

    private void updateRoles(String userId, List<String> roles) {
        jdbcTemplate.update(
            """
                UPDATE auth.user_profile
                SET roles_csv = ?, updated_at = ?
                WHERE user_id = ?
                """,
            rolesToCsv(roles),
            Timestamp.from(Instant.now()),
            userId
        );
    }

    private static CorpUserRecord mapRow(ResultSet rs) throws SQLException {
        return new CorpUserRecord(
            rs.getString("user_id"),
            rs.getString("email"),
            normalizeStatus(rs.getString("account_status")),
            csvToRoles(rs.getString("roles_csv")),
            rs.getString("department"),
            rs.getString("manager_id"),
            rs.getTimestamp("updated_at").toInstant()
        );
    }

    private static String normalizeStatus(String value) {
        if (value == null || value.isBlank()) {
            return "ACTIVE";
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizeRole(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private static List<String> mergeRoles(List<String> base, List<String> incoming) {
        List<String> merged = new ArrayList<>();
        if (base != null) {
            base.stream()
                .map(JdbcCorpUserAdminAdapter::normalizeRole)
                .filter(role -> !role.isBlank())
                .forEach(merged::add);
        }
        if (incoming != null) {
            for (String role : incoming) {
                String normalized = normalizeRole(role);
                if (normalized.isBlank()) {
                    continue;
                }
                if (merged.stream().noneMatch(existing -> existing.equalsIgnoreCase(normalized))) {
                    merged.add(normalized);
                }
            }
        }
        return merged;
    }

    private static String rolesToCsv(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return "";
        }
        return String.join(",", roles.stream()
            .map(JdbcCorpUserAdminAdapter::normalizeRole)
            .filter(role -> !role.isBlank())
            .toList());
    }

    private static List<String> csvToRoles(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Collections.unmodifiableList(
            Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(JdbcCorpUserAdminAdapter::normalizeRole)
                .toList()
        );
    }

    private static String coalesce(String value, String fallback) {
        return value == null ? fallback : value;
    }
}
