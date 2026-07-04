package in.cloudxplorer.authservice.config;

import java.net.http.HttpClient;
import javax.net.ssl.SSLContext;

import in.cloudxplorer.authservice.security.KeycloakJwtAuthenticationConverter;
import in.cloudxplorer.authservice.security.UserAccessResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Objects;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource(AuthServiceProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.getSecurity().getCors().getAllowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            KeycloakJwtAuthenticationConverter jwtAuthenticationConverter,
            AuthServiceProperties properties,
            UserAccessResolver userAccessResolver
    ) throws Exception {
        String customerRole = userAccessResolver.roleAuthority(properties.getSecurity().getCustomerRole());
        String corporateRole = userAccessResolver.roleAuthority(properties.getSecurity().getCorporateRole());
        String adminRole = userAccessResolver.roleAuthority(properties.getSecurity().getAdminRole());
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource(properties)))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/health", "/docs", "/docs/**", "/swagger-ui/**", "/v3/api-docs/**", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/auth/test/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/auth/frontend-config").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/customer/register", "/auth/customer/login", "/auth/corporate/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/customer/logout").hasAnyAuthority(customerRole, adminRole)
                        .requestMatchers(HttpMethod.POST, "/auth/corporate/logout").hasAnyAuthority(corporateRole, adminRole)
                        .requestMatchers(HttpMethod.DELETE, "/auth/customer/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/auth/me").authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)));

        return http.build();
    }

    @Bean
    public JwtDecoder jwtDecoder(AuthServiceProperties properties) {
        AuthServiceProperties.Keycloak keycloak = properties.getKeycloak();
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(keycloak.jwkSetUri())
                .restOperations(keycloakJwtRestTemplate(keycloak))
                .build();
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),
                JwtValidators.createDefaultWithIssuer(keycloak.publicIssuerUri())
        );
        decoder.setJwtValidator(validator);
        return decoder;
    }

    private RestTemplate keycloakJwtRestTemplate(AuthServiceProperties.Keycloak keycloak) {
        HttpClient.Builder httpClientBuilder = HttpClient.newBuilder()
                .connectTimeout(keycloak.getConnectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL);
        SSLContext sslContext = KeycloakSslContextFactory.create(keycloak);
        if (sslContext != null) {
            httpClientBuilder.sslContext(sslContext);
        }
        HttpClient httpClient = Objects.requireNonNull(httpClientBuilder.build(), "HttpClient must not be null");
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Objects.requireNonNull(keycloak.getReadTimeout(), "Keycloak read timeout must not be null"));
        return new RestTemplate(requestFactory);
    }
}
