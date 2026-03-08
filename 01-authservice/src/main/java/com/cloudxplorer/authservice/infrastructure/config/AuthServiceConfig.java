package com.cloudxplorer.authservice.infrastructure.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(AuthServiceProperties.class)
public class AuthServiceConfig {

    @Bean
    public RestClient restClient() {
        return RestClient.builder().build();
    }
}
