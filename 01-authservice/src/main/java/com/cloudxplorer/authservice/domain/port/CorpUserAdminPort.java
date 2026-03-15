package com.cloudxplorer.authservice.domain.port;

import com.cloudxplorer.authservice.domain.model.CorpUserRecord;
import java.util.List;

public interface CorpUserAdminPort {
    CorpUserRecord create(String email, List<String> roles, String department, String managerId);

    CorpUserRecord update(String userId, String status, String department, String managerId);

    CorpUserRecord getById(String userId);

    CorpUserRecord getByEmail(String email);

    CorpUserRecord addRole(String userId, String roleId);

    CorpUserRecord removeRole(String userId, String roleId);

    void setStatus(String userId, String status);
}
