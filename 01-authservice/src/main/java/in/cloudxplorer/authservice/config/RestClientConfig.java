package in.cloudxplorer.authservice.config;

import java.net.http.HttpClient;
import javax.net.ssl.SSLContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient keycloakRestClient(RestClient.Builder builder, AuthServiceProperties properties) {
        AuthServiceProperties.Keycloak keycloak = properties.getKeycloak();
        HttpClient.Builder httpClientBuilder = HttpClient.newBuilder()
                .connectTimeout(keycloak.getConnectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL);
        SSLContext sslContext = KeycloakSslContextFactory.create(keycloak);
        if (sslContext != null) {
            httpClientBuilder.sslContext(sslContext);
        }
        HttpClient httpClient = httpClientBuilder.build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(java.util.Objects.requireNonNull(httpClient));
        requestFactory.setReadTimeout(java.util.Objects.requireNonNull(keycloak.getReadTimeout()));
        return builder.requestFactory(requestFactory).build();
    }
}
