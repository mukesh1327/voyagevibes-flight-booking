package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.dto.common.ErrorResponse;
import com.cloudxplorer.authservice.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        return build(ex.status(), ex.code(), ex.getMessage(), request, Map.of());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "AUTH_BAD_REQUEST", ex.getMessage(), request, Map.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, Object> validationErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(err -> validationErrors.put(err.getField(), err.getDefaultMessage()));
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed", request, validationErrors);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleJsonParse(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "INVALID_JSON", "Malformed or invalid JSON payload", request, Map.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "AUTH_INTERNAL_ERROR", "Unexpected server error", request, Map.of());
    }

    private ResponseEntity<ErrorResponse> build(
        HttpStatus status,
        String code,
        String message,
        HttpServletRequest request,
        Map<String, Object> extraDetails
    ) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("path", request.getRequestURI());
        details.putAll(extraDetails);

        ErrorResponse response = new ErrorResponse(
            code,
            message,
            UUID.randomUUID().toString(),
            details
        );
        return ResponseEntity.status(status).body(response);
    }
}
