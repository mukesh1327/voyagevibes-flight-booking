package in.cloudxplorer.authservice.exception;

import org.springframework.http.HttpStatus;

public class AuthServiceException extends RuntimeException {

    private final HttpStatus status;

    public AuthServiceException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
