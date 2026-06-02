package in.cloudxplorer.authservice.service;

import in.cloudxplorer.authservice.dto.CustomerProfileResponse;
import in.cloudxplorer.authservice.entity.CustomerProfile;
import in.cloudxplorer.authservice.model.KeycloakUserProfile;
import in.cloudxplorer.authservice.repository.CustomerProfileRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerProfileService {

    private final CustomerProfileRepository repository;

    public CustomerProfileService(CustomerProfileRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public UpsertResult upsert(KeycloakUserProfile profile) {
        Instant now = Instant.now();
        String userId = profile.subject().strip();
        if (userId == null || userId.isEmpty()) {
            throw new IllegalArgumentException("User ID cannot be null or empty");
        }
        CustomerProfile customerProfile = repository.findById(userId)
                .orElseGet(CustomerProfile::new);

        boolean created = customerProfile.getKeycloakUserId() == null;
        if (created) {
            customerProfile.setKeycloakUserId(profile.subject());
            customerProfile.setCreatedAt(now);
        }

        customerProfile.setEmail(profile.email());
        customerProfile.setFullName(profile.fullName());
        customerProfile.setGivenName(profile.givenName());
        customerProfile.setFamilyName(profile.familyName());
        customerProfile.setIdentityProvider(profile.identityProvider());
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
}
