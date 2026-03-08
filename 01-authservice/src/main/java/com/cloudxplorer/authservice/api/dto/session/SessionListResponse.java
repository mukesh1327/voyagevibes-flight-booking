package com.cloudxplorer.authservice.api.dto.session;

import java.util.List;

public record SessionListResponse(List<SessionInfo> sessions) {
}
