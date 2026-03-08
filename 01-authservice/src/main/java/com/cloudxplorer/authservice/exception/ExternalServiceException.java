package com.cloudxplorer.authservice.exception;

import org.springframework.http.HttpStatus;

public class ExternalServiceException extends ApiException {
    public ExternalServiceException(String code, String message) {
        super(code, message, HttpStatus.BAD_GATEWAY);
    }

    public ExternalServiceException(String code, String message, Throwable cause) {
        super(code, message, HttpStatus.BAD_GATEWAY);
        initCause(cause);
    }
}
