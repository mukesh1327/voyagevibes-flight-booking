package in.cloudxplorer.authservice.repository;

import in.cloudxplorer.authservice.entity.DemoClickEvent;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DemoClickEventRepository extends JpaRepository<DemoClickEvent, UUID> {
}
