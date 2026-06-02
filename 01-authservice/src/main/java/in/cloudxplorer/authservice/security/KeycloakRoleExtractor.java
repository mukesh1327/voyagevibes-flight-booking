package in.cloudxplorer.authservice.security;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class KeycloakRoleExtractor {

    public Set<String> extractRoles(Map<String, Object> claims, String clientId) {
        Set<String> roles = new LinkedHashSet<>();
        extractRealmRoles(claims).forEach(roles::add);
        extractClientRoles(claims, clientId).forEach(roles::add);
        return roles;
    }

    public Collection<GrantedAuthority> extractGrantedAuthorities(Map<String, Object> claims, String clientId) {
        return extractRoles(claims, clientId).stream()
                .map(role -> "ROLE_" + role.toUpperCase(Locale.ROOT).replace('-', '_'))
                .map(SimpleGrantedAuthority::new)
                .map(GrantedAuthority.class::cast)
                .toList();
    }

    private List<String> extractRealmRoles(Map<String, Object> claims) {
        Object realmAccess = claims.get("realm_access");
        if (realmAccess instanceof Map<?, ?> realmMap) {
            Object roles = realmMap.get("roles");
            if (roles instanceof List<?> values) {
                return values.stream()
                        .filter(String.class::isInstance)
                        .map(String.class::cast)
                        .filter(StringUtils::hasText)
                        .toList();
            }
        }
        return List.of();
    }

    private List<String> extractClientRoles(Map<String, Object> claims, String clientId) {
        Object resourceAccess = claims.get("resource_access");
        if (resourceAccess instanceof Map<?, ?> resourceMap) {
            Object clientAccess = resourceMap.get(clientId);
            if (clientAccess instanceof Map<?, ?> clientMap) {
                Object roles = clientMap.get("roles");
                if (roles instanceof List<?> values) {
                    return values.stream()
                            .filter(String.class::isInstance)
                            .map(String.class::cast)
                            .filter(StringUtils::hasText)
                            .toList();
                }
            }
        }
        return List.of();
    }
}
