package com.cloudxplorer.authservice.exception;

import org.springframework.http.HttpStatus;

public class ConfigurationException extends ApiException {
    public ConfigurationException(String code, String message) {
        super(code, message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
