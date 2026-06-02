package in.cloudxplorer.authservice.repository;

import in.cloudxplorer.authservice.entity.CustomerProfile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerProfileRepository extends JpaRepository<CustomerProfile, String> {
}
