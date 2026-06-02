package in.cloudxplorer.authservice.config;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.net.http.HttpClient;
import java.security.KeyStore;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient keycloakRestClient(RestClient.Builder builder, AuthServiceProperties properties) {
        AuthServiceProperties.Keycloak keycloak = properties.getKeycloak();
        HttpClient.Builder httpClientBuilder = HttpClient.newBuilder()
                .connectTimeout(keycloak.getConnectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL);
        SSLContext sslContext = sslContext(keycloak);
        if (sslContext != null) {
            httpClientBuilder.sslContext(sslContext);
        }
        HttpClient httpClient = httpClientBuilder.build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(java.util.Objects.requireNonNull(httpClient));
        requestFactory.setReadTimeout(java.util.Objects.requireNonNull(keycloak.getReadTimeout()));
        return builder.requestFactory(requestFactory).build();
    }

    private SSLContext sslContext(AuthServiceProperties.Keycloak properties) {
        if (!StringUtils.hasText(properties.getTrustStorePath())) {
            return null;
        }
        try {
            KeyStore keyStore = KeyStore.getInstance(properties.getTrustStoreType());
            try (InputStream inputStream = Files.newInputStream(Path.of(properties.getTrustStorePath()))) {
                char[] password = properties.getTrustStorePassword() == null
                        ? new char[0]
                        : properties.getTrustStorePassword().toCharArray();
                keyStore.load(inputStream, password);
                TrustManagerFactory trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                trustManagerFactory.init(keyStore);
                SSLContext sslContext = SSLContext.getInstance("TLS");
                sslContext.init(null, trustManagerFactory.getTrustManagers(), null);
                return sslContext;
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to initialize Keycloak trust store", ex);
        }
    }
}
