package com.cloudxplorer.authservice.api.dto.corpauth;

public record DeviceInfo(
    String userAgent,
    String ip,
    String deviceId,
    String platform
) {
}
