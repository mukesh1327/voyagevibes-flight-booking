package com.cloudxplorer.authservice.domain.port;

import com.cloudxplorer.authservice.domain.model.LoginFlowState;

public interface LoginFlowStatePort {
    void save(LoginFlowState state);

    LoginFlowState get(String state);

    LoginFlowState consume(String state);
}
