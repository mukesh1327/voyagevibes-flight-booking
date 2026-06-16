package in.cloudxplorer.authservice.config;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;

import org.springframework.util.StringUtils;

final class KeycloakSslContextFactory {

    private KeycloakSslContextFactory() {
    }

    static SSLContext create(AuthServiceProperties.Keycloak properties) {
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
