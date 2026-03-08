package com.cloudxplorer.authservice.infrastructure.config;

import org.apache.catalina.connector.Connector;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.net.InetAddress;
import java.net.UnknownHostException;

@Configuration
public class DualPortTomcatConfig {

    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> dualPortCustomizer(Environment environment) {
        return factory -> {
            String bindAddress = textOrDefault(environment.getProperty("AUTHSERVICE_BIND_ADDRESS"), "0.0.0.0");
            factory.setAddress(resolveAddress(bindAddress));

            int httpPort = resolvePort(environment.getProperty("AUTHSERVICE_HTTP_PORT"), 8081);
            int httpsPort = resolvePort(environment.getProperty("AUTHSERVICE_HTTPS_PORT"), 9091);
            boolean sslEnabled = Boolean.parseBoolean(
                textOrDefault(environment.getProperty("SERVER_SSL_ENABLED"), environment.getProperty("server.ssl.enabled", "true"))
            );

            if (!sslEnabled) {
                factory.setPort(httpPort);
                return;
            }

            factory.setPort(httpsPort);
            if (httpPort == httpsPort) {
                return;
            }

            Connector httpConnector = new Connector(TomcatServletWebServerFactory.DEFAULT_PROTOCOL);
            httpConnector.setScheme("http");
            httpConnector.setSecure(false);
            httpConnector.setPort(httpPort);
            httpConnector.setProperty("address", bindAddress);
            factory.addAdditionalConnectors(httpConnector);
        };
    }

    private static int resolvePort(String rawValue, int fallback) {
        try {
            int parsed = Integer.parseInt(textOrDefault(rawValue, Integer.toString(fallback)));
            return parsed > 0 ? parsed : fallback;
        } catch (NumberFormatException _error) {
            return fallback;
        }
    }

    private static String textOrDefault(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private static InetAddress resolveAddress(String bindAddress) {
        try {
            return InetAddress.getByName(bindAddress);
        } catch (UnknownHostException _error) {
            try {
                return InetAddress.getByName("0.0.0.0");
            } catch (UnknownHostException impossible) {
                throw new IllegalStateException("Unable to resolve bind address", impossible);
            }
        }
    }
}
