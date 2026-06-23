package in.cloudxplorer.authservice.controller;

import in.cloudxplorer.authservice.dto.DemoClickRequest;
import in.cloudxplorer.authservice.dto.DemoClickResponse;
import in.cloudxplorer.authservice.service.DemoTraceService;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.TextMapGetter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Collections;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/demo")
public class DemoTraceController {

    private static final TextMapGetter<HttpServletRequest> REQUEST_GETTER = new TextMapGetter<>() {
        @Override
        public Iterable<String> keys(HttpServletRequest carrier) {
            return Collections.list(carrier.getHeaderNames());
        }

        @Override
        public String get(HttpServletRequest carrier, String key) {
            return carrier.getHeader(key);
        }
    };

    private final DemoTraceService demoTraceService;
    private final OpenTelemetry openTelemetry;

    public DemoTraceController(DemoTraceService demoTraceService, OpenTelemetry openTelemetry) {
        this.demoTraceService = demoTraceService;
        this.openTelemetry = openTelemetry;
    }

    @PostMapping("/button-click")
    @ResponseStatus(HttpStatus.CREATED)
    public DemoClickResponse recordButtonClick(
            @Valid @RequestBody DemoClickRequest request,
            @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
            HttpServletRequest servletRequest
    ) {
        Context extractedContext = openTelemetry.getPropagators()
                .getTextMapPropagator()
                .extract(Context.current(), servletRequest, REQUEST_GETTER);
        return demoTraceService.recordButtonClick(request, userAgent, extractedContext);
    }
}
