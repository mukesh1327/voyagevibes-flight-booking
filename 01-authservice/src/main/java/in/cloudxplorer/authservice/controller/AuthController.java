package in.cloudxplorer.authservice.controller;

import in.cloudxplorer.authservice.dto.AuthCodeExchangeRequest;
import in.cloudxplorer.authservice.dto.AuthFrontendConfigResponse;
import in.cloudxplorer.authservice.dto.AuthTokenResponse;
import in.cloudxplorer.authservice.dto.AuthenticatedUserResponse;
import in.cloudxplorer.authservice.dto.LogoutRequest;
import in.cloudxplorer.authservice.service.AuthenticationService;
import in.cloudxplorer.authservice.web.ApiErrorResponse;
import in.cloudxplorer.authservice.web.SyntheticErrorRateResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;

@RestController
@RequestMapping("/auth")
@Tag(name = "Authentication", description = "Customer and corporate authentication endpoints backed by Keycloak.")
public class AuthController {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthenticationService authenticationService;

    public AuthController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/customer/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Register a customer using Keycloak Google login",
            description = "Exchanges a Keycloak authorization code, validates the customer role, and stores minimal customer metadata locally."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Customer registered successfully"),
            @ApiResponse(
                    responseCode = "401",
                    description = "Invalid or expired authorization code",
                    content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))
            )
    })
    public AuthTokenResponse registerCustomer(@Valid @RequestBody AuthCodeExchangeRequest request) {
        return authenticationService.registerCustomer(request);
    }

    @PostMapping("/customer/login")
    @Operation(
            summary = "Login a customer using Keycloak Google login",
            description = "Exchanges a Keycloak authorization code and returns JWT tokens issued by Keycloak."
    )
    public AuthTokenResponse loginCustomer(@Valid @RequestBody AuthCodeExchangeRequest request) {
        return authenticationService.loginCustomer(request);
    }

    @PostMapping("/customer/logout")
    @Operation(
            summary = "Logout a customer session",
            description = "Revokes the customer refresh token at Keycloak.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public void logoutCustomer(@Valid @RequestBody LogoutRequest request) {
        authenticationService.logout(request);
    }

    @DeleteMapping("/customer/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Delete a customer user",
            description = "Deletes the Keycloak user and removes any local customer metadata. Allowed for the same customer or an admin user.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public void deleteCustomer(@PathVariable("id") String customerId, Authentication authentication) {
        authenticationService.deleteCustomer(customerId, authentication);
    }

    @PostMapping("/corporate/login")
    @Operation(
            summary = "Login a corporate user",
            description = "Exchanges a Keycloak authorization code for tokens and validates the corporate role for federated users."
    )
    public AuthTokenResponse loginCorporate(@Valid @RequestBody AuthCodeExchangeRequest request) {
        return authenticationService.loginCorporate(request);
    }

    @PostMapping("/corporate/logout")
    @Operation(
            summary = "Logout a corporate user",
            description = "Revokes the corporate refresh token at Keycloak.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public void logoutCorporate(@Valid @RequestBody LogoutRequest request) {
        authenticationService.logout(request);
    }

    @GetMapping("/frontend-config")
    @Operation(
            summary = "Get frontend login configuration",
            description = "Returns public Keycloak and auth-service metadata so frontend applications can start customer and corporate login flows without hardcoding production settings."
    )
    public AuthFrontendConfigResponse frontendConfig() {
        return authenticationService.frontendConfig();
    }

    @GetMapping("/test/error-rate")
    @Operation(
            summary = "Generate a synthetic success or failure response",
            description = "Useful for exercising dashboards, tracing, and error-rate alerting without impacting real login flows."
    )
    public SyntheticErrorRateResponse testErrorRate(
            @RequestParam(name = "failureRatePercent", defaultValue = "20")
            @jakarta.validation.constraints.Min(0)
            @jakarta.validation.constraints.Max(100)
            int failureRatePercent,
            @RequestParam(name = "sample", required = false)
            @jakarta.validation.constraints.Min(0)
            @jakarta.validation.constraints.Max(99)
            Integer sample
    ) {
        int resolvedSample = sample != null ? sample : RANDOM.nextInt(100);
        boolean failed = resolvedSample < failureRatePercent;
        if (failed) {
            throw new in.cloudxplorer.authservice.exception.AuthServiceException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Synthetic failure for error-rate testing"
            );
        }

        return new SyntheticErrorRateResponse(
                java.time.Instant.now(),
                false,
                failureRatePercent,
                resolvedSample,
                "Synthetic request succeeded"
        );
    }

    @GetMapping("/me")
    @Operation(
            summary = "Get the current authenticated user",
            description = "Returns user information resolved from the validated JWT token. Bearer token required.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Authenticated user details"),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid Bearer token",
                    content = @Content(
                            schema = @Schema(implementation = ApiErrorResponse.class),
                            examples = @ExampleObject(value = """
                                    {
                                      "status": 401,
                                      "error": "Unauthorized",
                                      "message": "Missing authenticated JWT principal",
                                      "path": "/auth/me"
                                    }
                                    """)
                    )
            )
    })
    public AuthenticatedUserResponse me(Authentication authentication) {
        return authenticationService.me(authentication);
    }
}
