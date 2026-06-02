package in.cloudxplorer.authservice.security;

import in.cloudxplorer.authservice.model.UserType;
import java.util.Set;

public record UserAccessProfile(
        UserType userType,
        String baseRole,
        Set<String> applicationRoles,
        Set<String> corporateRoles
) {
}
