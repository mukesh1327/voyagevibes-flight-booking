package com.cloudxplorer.authservice.domain.port;

import com.cloudxplorer.authservice.domain.model.IdentityUser;
import com.cloudxplorer.authservice.domain.model.UserProfile;

public interface UserProfilePort {
    UserProfile createOrGetFromIdentity(IdentityUser user);

    UserProfile getByUserId(String userId);

    UserProfile update(String userId, String firstName, String lastName, String mobile);
}
