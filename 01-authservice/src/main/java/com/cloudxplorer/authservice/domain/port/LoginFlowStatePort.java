package com.cloudxplorer.authservice.domain.port;

import com.cloudxplorer.authservice.domain.model.LoginFlowState;

public interface LoginFlowStatePort {
    void save(LoginFlowState state);

    LoginFlowState consume(String state);
}
