package in.cloudxplorer.authservice.security;

import in.cloudxplorer.authservice.config.AuthServiceProperties;
import in.cloudxplorer.authservice.exception.AuthServiceException;
import in.cloudxplorer.authservice.model.UserType;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class UserAccessResolver {

    private final AuthServiceProperties properties;

    public UserAccessResolver(AuthServiceProperties properties) {
        this.properties = properties;
    }

    public UserAccessProfile resolve(Set<String> rawRoles) {
        Set<String> roles = normalize(rawRoles);
        boolean customer = hasRole(roles, properties.getSecurity().getCustomerRole());
        boolean corporate = hasRole(roles, properties.getSecurity().getCorporateRole());

        if (customer && corporate) {
            throw new AuthServiceException(
                    HttpStatus.FORBIDDEN,
                    "A single session cannot carry both customer and corporate base roles"
            );
        }
        if (!customer && !corporate) {
            throw new AuthServiceException(HttpStatus.FORBIDDEN, "No supported application base role was found");
        }

        UserType userType = corporate ? UserType.CORPORATE : UserType.CUSTOMER;
        String baseRole = corporate ? properties.getSecurity().getCorporateRole() : properties.getSecurity().getCustomerRole();
        Set<String> corporateRoles = corporate ? corporateSubRoles(roles) : Set.of();
        return new UserAccessProfile(userType, baseRole, roles, corporateRoles);
    }

    public boolean hasRole(Set<String> roles, String targetRole) {
        return roles.stream().anyMatch(role -> role.equalsIgnoreCase(targetRole));
    }

    public Set<String> normalize(Set<String> rawRoles) {
        Set<String> roles = new LinkedHashSet<>();
        if (rawRoles == null) {
            return roles;
        }
        rawRoles.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .filter(role -> properties.getSecurity().getIgnoredRoles().stream()
                        .noneMatch(ignored -> ignored.equalsIgnoreCase(role)))
                .forEach(roles::add);
        return roles;
    }

    private Set<String> corporateSubRoles(Set<String> roles) {
        Set<String> corporateRoles = new LinkedHashSet<>();
        for (String role : roles) {
            if (role.equalsIgnoreCase(properties.getSecurity().getCorporateRole())) {
                continue;
            }
            if (role.equalsIgnoreCase(properties.getSecurity().getCustomerRole())) {
                continue;
            }
            corporateRoles.add(role);
        }
        return corporateRoles;
    }

    public String roleAuthority(String role) {
        return "ROLE_" + role.toUpperCase(Locale.ROOT).replace('-', '_');
    }
}
