package in.cloudxplorer.authservice.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;
import java.util.Map;

public final class JwtClaimUtils {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private JwtClaimUtils() {
    }

    public static Map<String, Object> decodeClaims(String token) {
        if (token == null || token.isBlank()) {
            return Collections.emptyMap();
        }
        String[] parts = token.split("\\.");
        if (parts.length < 2) {
            return Collections.emptyMap();
        }
        try {
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            return OBJECT_MAPPER.readValue(new String(payload, StandardCharsets.UTF_8), MAP_TYPE);
        } catch (Exception ex) {
            return Collections.emptyMap();
        }
    }
}
