package in.cloudxplorer.authservice.security;

import in.cloudxplorer.authservice.config.AuthServiceProperties;
import java.util.Collection;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.lang.NonNull;

@Component
public class KeycloakJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final KeycloakRoleExtractor roleExtractor;
    private final AuthServiceProperties properties;

    public KeycloakJwtAuthenticationConverter(KeycloakRoleExtractor roleExtractor, AuthServiceProperties properties) {
        this.roleExtractor = roleExtractor;
        this.properties = properties;
    }

    @Override@NonNull 
    public AbstractAuthenticationToken convert(@NonNull Jwt jwt) {
        Collection<GrantedAuthority> authorities = roleExtractor.extractGrantedAuthorities(
                jwt.getClaims(),
                properties.getKeycloak().getClientId()
        );
        return new JwtAuthenticationToken(jwt, authorities, jwt.getClaimAsString("preferred_username"));
    }
}
