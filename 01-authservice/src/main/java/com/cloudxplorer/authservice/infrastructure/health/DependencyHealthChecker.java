package com.cloudxplorer.authservice.infrastructure.health;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class DependencyHealthChecker {

    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(3);
    private static final int SOCKET_TIMEOUT_MS = 3000;

    private final Environment environment;
    private final HttpClient httpClient;

    public DependencyHealthChecker(Environment environment) {
        this.environment = environment;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(HTTP_TIMEOUT)
            .build();
    }

    public Map<String, String> checkKeycloak(String keycloakBaseUrl) {
        Map<String, String> result = new LinkedHashMap<>();
        if (isBlank(keycloakBaseUrl)) {
            result.put("status", "DOWN");
            result.put("reason", "KEYCLOAK_URL_MISSING");
            return result;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(keycloakBaseUrl))
                .timeout(HTTP_TIMEOUT)
                .GET()
                .build();
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            int code = response.statusCode();
            if (code >= 200 && code < 500) {
                result.put("status", "UP");
                result.put("reason", "REACHABLE");
            } else {
                result.put("status", "DOWN");
                result.put("reason", "HTTP_" + code);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            result.put("status", "DOWN");
            result.put("reason", "INTERRUPTED");
        } catch (Exception e) {
            result.put("status", "DOWN");
            result.put("reason", "UNREACHABLE:" + e.getClass().getSimpleName());
        }
        return result;
    }

    public Map<String, String> checkDatabase() {
        Map<String, String> result = new LinkedHashMap<>();
        String dbUrl = environment.getProperty("spring.datasource.url");
        if (isBlank(dbUrl)) {
            dbUrl = environment.getProperty("AUTH_DB_URL");
        }

        if (isBlank(dbUrl)) {
            result.put("status", "DOWN");
            result.put("reason", "DB_URL_MISSING");
            return result;
        }

        try {
            HostPort hostPort = parseJdbcHostPort(dbUrl);
            if (hostPort == null || isBlank(hostPort.host())) {
                result.put("status", "DOWN");
                result.put("reason", "DB_URL_INVALID");
                return result;
            }

            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(hostPort.host(), hostPort.port()), SOCKET_TIMEOUT_MS);
            }

            result.put("status", "UP");
            result.put("reason", "REACHABLE");
            result.put("target", hostPort.host() + ":" + hostPort.port());
        } catch (IOException e) {
            result.put("status", "DOWN");
            result.put("reason", "UNREACHABLE:" + e.getClass().getSimpleName());
        } catch (Exception e) {
            result.put("status", "DOWN");
            result.put("reason", "DB_CHECK_FAILED:" + e.getClass().getSimpleName());
        }

        return result;
    }

    private static HostPort parseJdbcHostPort(String jdbcUrl) throws URISyntaxException {
        if (jdbcUrl.startsWith("jdbc:postgresql://")) {
            return parseStandardJdbcHostPort(jdbcUrl, "jdbc:postgresql://", 5432);
        }
        if (jdbcUrl.startsWith("jdbc:mysql://")) {
            return parseStandardJdbcHostPort(jdbcUrl, "jdbc:mysql://", 3306);
        }
        if (jdbcUrl.startsWith("jdbc:sqlserver://")) {
            String remainder = jdbcUrl.substring("jdbc:sqlserver://".length());
            String hostPortToken = remainder.split(";")[0];
            String[] parts = hostPortToken.split(":");
            String host = parts[0];
            int port = parts.length > 1 ? Integer.parseInt(parts[1]) : 1433;
            return new HostPort(host, port);
        }
        if (jdbcUrl.startsWith("mongodb://") || jdbcUrl.startsWith("mongodb+srv://")) {
            URI uri = URI.create(jdbcUrl);
            int defaultPort = jdbcUrl.startsWith("mongodb+srv://") ? 27017 : 27017;
            return new HostPort(uri.getHost(), uri.getPort() > 0 ? uri.getPort() : defaultPort);
        }
        return null;
    }

    private static HostPort parseStandardJdbcHostPort(String jdbcUrl, String prefix, int defaultPort) {
        String remainder = jdbcUrl.substring(prefix.length());
        if (isBlank(remainder)) {
            return null;
        }

        String authority = remainder;
        int pathIndex = authority.indexOf('/');
        if (pathIndex >= 0) {
            authority = authority.substring(0, pathIndex);
        }

        int queryIndex = authority.indexOf('?');
        if (queryIndex >= 0) {
            authority = authority.substring(0, queryIndex);
        }

        if (isBlank(authority)) {
            return null;
        }

        String host = authority;
        int port = defaultPort;
        int colonIndex = authority.lastIndexOf(':');
        if (colonIndex >= 0 && colonIndex < authority.length() - 1) {
            host = authority.substring(0, colonIndex);
            port = Integer.parseInt(authority.substring(colonIndex + 1));
        }

        return new HostPort(host, port);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record HostPort(String host, int port) {
    }
}

