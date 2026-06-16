package in.cloudxplorer.authservice.service;

import in.cloudxplorer.authservice.dto.CustomerProfileResponse;
import in.cloudxplorer.authservice.entity.CustomerProfile;
import in.cloudxplorer.authservice.model.KeycloakUserProfile;
import in.cloudxplorer.authservice.repository.CustomerProfileRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CustomerProfileService {

    private final CustomerProfileRepository repository;

    public CustomerProfileService(CustomerProfileRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public UpsertResult upsert(KeycloakUserProfile profile) {
        Instant now = Instant.now();
        String userId = normalize(profile.subject());
        if (!StringUtils.hasText(userId)) {
            throw new IllegalArgumentException("User ID cannot be null or empty");
        }
        String email = resolveEmail(profile, userId);
        CustomerProfile customerProfile = repository.findById(userId)
                .orElseGet(CustomerProfile::new);

        boolean created = customerProfile.getKeycloakUserId() == null;
        if (created) {
            customerProfile.setKeycloakUserId(userId);
            customerProfile.setCreatedAt(now);
        }

        customerProfile.setEmail(email);
        customerProfile.setFullName(normalize(profile.fullName()));
        customerProfile.setGivenName(normalize(profile.givenName()));
        customerProfile.setFamilyName(normalize(profile.familyName()));
        customerProfile.setIdentityProvider(normalize(profile.identityProvider()));
        customerProfile.setEmailVerified(profile.emailVerified());
        customerProfile.setUpdatedAt(now);

        CustomerProfile saved = repository.save(customerProfile);
        return new UpsertResult(toResponse(saved), created);
    }

    @Transactional
    public void deleteByKeycloakUserId(String userId) {
        if (userId != null) {
            repository.deleteById(userId);
        }
    }

    public CustomerProfileResponse toResponse(CustomerProfile profile) {
        return new CustomerProfileResponse(
                profile.getKeycloakUserId(),
                profile.getEmail(),
                profile.getFullName(),
                profile.getIdentityProvider(),
                profile.getCreatedAt(),
                profile.getUpdatedAt()
        );
    }

    public record UpsertResult(CustomerProfileResponse profile, boolean created) {
    }

    private String resolveEmail(KeycloakUserProfile profile, String userId) {
        String email = normalize(profile.email());
        if (StringUtils.hasText(email)) {
            return email;
        }
        String username = normalize(profile.username());
        if (StringUtils.hasText(username)) {
            return username;
        }
        return userId;
    }

    private String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.strip();
    }
}
