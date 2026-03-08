package com.cloudxplorer.authservice.infrastructure.adapter.prod;

import com.cloudxplorer.authservice.domain.model.IdentityUser;
import com.cloudxplorer.authservice.domain.model.UserProfile;
import com.cloudxplorer.authservice.domain.port.UserProfilePort;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Component
public class JdbcUserProfileAdapter implements UserProfilePort {

    private final JdbcTemplate jdbcTemplate;

    public JdbcUserProfileAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public UserProfile createOrGetFromIdentity(IdentityUser user) {
        String userId = "usr_" + user.providerUserId().replace("-", "");
        UserProfile existing = getByUserId(userId);
        if (existing != null) {
            if (shouldRefreshFromIdentity(existing, user)) {
                return refreshFromIdentity(existing, user);
            }
            return existing;
        }

        String email = user.email() == null ? "" : user.email();
        String firstName = safe(user.firstName());
        String lastName = safe(user.lastName());
        String mobile = safe(user.mobile());
        String rolesCsv = rolesToCsv(user.roles());
        String status = (isBlank(firstName) || isBlank(lastName)) ? "INCOMPLETE" : "COMPLETE";
        Instant now = Instant.now();

        try {
            jdbcTemplate.update(
                """
                    INSERT INTO auth.user_profile
                        (user_id, email, first_name, last_name, mobile, mobile_verified, realm, roles_csv, profile_status, updated_at)
                    VALUES
                        (?, ?, ?, ?, ?, FALSE, ?, ?, ?, ?)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                userId, email, firstName, lastName, mobile, user.realm(), rolesCsv, status, Timestamp.from(now)
            );
        } catch (DataAccessException ex) {
            UserProfile byEmail = getByEmail(email);
            if (byEmail != null) {
                return byEmail;
            }
            throw ex;
        }

        return Optional.ofNullable(getByUserId(userId))
            .orElseGet(() -> new UserProfile(
                userId,
                email,
                firstName,
                lastName,
                mobile,
                false,
                user.realm(),
                user.roles() == null ? List.of() : user.roles(),
                status,
                now
            ));
    }

    @Override
    public UserProfile getByUserId(String userId) {
        List<UserProfile> rows = jdbcTemplate.query(
            """
                SELECT user_id, email, first_name, last_name, mobile, mobile_verified, realm, roles_csv, profile_status, updated_at
                FROM auth.user_profile
                WHERE user_id = ?
                """,
            (rs, rowNum) -> mapRow(rs),
            userId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    private UserProfile getByEmail(String email) {
        List<UserProfile> rows = jdbcTemplate.query(
            """
                SELECT user_id, email, first_name, last_name, mobile, mobile_verified, realm, roles_csv, profile_status, updated_at
                FROM auth.user_profile
                WHERE email = ?
                """,
            (rs, rowNum) -> mapRow(rs),
            email
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Override
    public UserProfile update(String userId, String firstName, String lastName, String mobile) {
        UserProfile current = getByUserId(userId);
        if (current == null) {
            throw new IllegalArgumentException("User not found");
        }

        String nextFirstName = firstName == null ? current.firstName() : firstName;
        String nextLastName = lastName == null ? current.lastName() : lastName;
        String nextMobile = mobile == null ? current.mobile() : mobile;
        String status = (isBlank(nextFirstName) || isBlank(nextLastName)) ? "INCOMPLETE" : "COMPLETE";
        Instant now = Instant.now();

        jdbcTemplate.update(
            """
                UPDATE auth.user_profile
                SET first_name = ?, last_name = ?, mobile = ?, profile_status = ?, updated_at = ?
                WHERE user_id = ?
                """,
            nextFirstName, nextLastName, nextMobile, status, Timestamp.from(now), userId
        );

        return new UserProfile(
            current.userId(),
            current.email(),
            nextFirstName,
            nextLastName,
            nextMobile,
            current.mobileVerified(),
            current.realm(),
            current.roles(),
            status,
            now
        );
    }

    private static UserProfile mapRow(ResultSet rs) throws SQLException {
        String rolesCsv = rs.getString("roles_csv");
        Instant updatedAt = rs.getTimestamp("updated_at").toInstant();
        return new UserProfile(
            rs.getString("user_id"),
            rs.getString("email"),
            safe(rs.getString("first_name")),
            safe(rs.getString("last_name")),
            rs.getString("mobile"),
            rs.getBoolean("mobile_verified"),
            rs.getString("realm"),
            csvToRoles(rolesCsv),
            rs.getString("profile_status"),
            updatedAt
        );
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private UserProfile refreshFromIdentity(UserProfile current, IdentityUser user) {
        String nextFirstName = choosePreferred(current.firstName(), user.firstName());
        String nextLastName = choosePreferred(current.lastName(), user.lastName());
        String nextMobile = choosePreferred(current.mobile(), user.mobile());
        String nextEmail = isBlank(current.email()) ? safe(user.email()) : current.email();
        String status = (isBlank(nextFirstName) || isBlank(nextLastName)) ? "INCOMPLETE" : "COMPLETE";
        Instant now = Instant.now();

        jdbcTemplate.update(
            """
                UPDATE auth.user_profile
                SET email = ?, first_name = ?, last_name = ?, mobile = ?, profile_status = ?, updated_at = ?
                WHERE user_id = ?
                """,
            nextEmail, nextFirstName, nextLastName, nextMobile, status, Timestamp.from(now), current.userId()
        );

        return new UserProfile(
            current.userId(),
            nextEmail,
            nextFirstName,
            nextLastName,
            nextMobile,
            current.mobileVerified(),
            current.realm(),
            current.roles(),
            status,
            now
        );
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean shouldRefreshFromIdentity(UserProfile current, IdentityUser user) {
        return shouldReplace(current.firstName(), user.firstName())
            || shouldReplace(current.lastName(), user.lastName())
            || shouldReplace(current.mobile(), user.mobile())
            || isBlank(current.email()) && !isBlank(user.email());
    }

    private static boolean shouldReplace(String currentValue, String identityValue) {
        return isBlank(currentValue) && !isBlank(identityValue);
    }

    private static String choosePreferred(String currentValue, String identityValue) {
        return shouldReplace(currentValue, identityValue) ? safe(identityValue) : safe(currentValue);
    }

    private static String rolesToCsv(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return "";
        }
        return String.join(",", roles);
    }

    private static List<String> csvToRoles(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Collections.unmodifiableList(
            Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList()
        );
    }
}
