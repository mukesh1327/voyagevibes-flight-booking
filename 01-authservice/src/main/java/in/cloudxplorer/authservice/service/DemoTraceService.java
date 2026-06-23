package in.cloudxplorer.authservice.service;

import in.cloudxplorer.authservice.dto.DemoClickRequest;
import in.cloudxplorer.authservice.dto.DemoClickResponse;
import in.cloudxplorer.authservice.entity.DemoClickEvent;
import in.cloudxplorer.authservice.repository.DemoClickEventRepository;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class DemoTraceService {

    private final DemoClickEventRepository repository;
    private final Tracer tracer;

    public DemoTraceService(DemoClickEventRepository repository, Tracer tracer) {
        this.repository = repository;
        this.tracer = tracer;
    }

    @Transactional
    public DemoClickResponse recordButtonClick(
            DemoClickRequest request,
            String userAgent,
            Context extractedContext
    ) {
        Span backendSpan = tracer.spanBuilder("demo backend: receive button click")
                .setParent(extractedContext)
                .setSpanKind(SpanKind.SERVER)
                .setAttribute("demo.session_id", request.sessionId())
                .setAttribute("demo.button_name", request.buttonName())
                .startSpan();

        try (Scope backendScope = backendSpan.makeCurrent()) {
            DemoClickEvent event = persistClickEvent(request, userAgent);
            long totalEvents = countClickEvents();

            backendSpan.setAttribute("demo.event_id", event.getId().toString());
            backendSpan.setAttribute("demo.total_events", totalEvents);
            backendSpan.setStatus(StatusCode.OK);

            return new DemoClickResponse(
                    event.getId(),
                    event.getSessionId(),
                    event.getButtonName(),
                    event.getTraceId(),
                    event.getSpanId(),
                    totalEvents,
                    event.getCreatedAt(),
                    "Browser click reached backend, touched the database, and returned to the UI."
            );
        } catch (RuntimeException exception) {
            backendSpan.recordException(exception);
            backendSpan.setStatus(StatusCode.ERROR, exception.getMessage());
            throw exception;
        } finally {
            backendSpan.end();
        }
    }

    private DemoClickEvent persistClickEvent(DemoClickRequest request, String userAgent) {
        Span dbSpan = tracer.spanBuilder("database insert: demo_click_events")
                .setSpanKind(SpanKind.CLIENT)
                .setAttribute("db.system", "postgresql")
                .setAttribute("db.operation", "INSERT")
                .setAttribute("db.sql.table", "demo_click_events")
                .startSpan();

        try (Scope ignored = dbSpan.makeCurrent()) {
            Span currentSpan = Span.current();
            DemoClickEvent event = new DemoClickEvent();
            event.setId(UUID.randomUUID());
            event.setSessionId(request.sessionId());
            event.setButtonName(request.buttonName());
            event.setTraceId(currentSpan.getSpanContext().getTraceId());
            event.setSpanId(currentSpan.getSpanContext().getSpanId());
            event.setUserAgent(truncate(userAgent, 512));
            event.setCreatedAt(Instant.now());
            DemoClickEvent saved = repository.saveAndFlush(event);

            dbSpan.setAttribute("demo.event_id", saved.getId().toString());
            return saved;
        } finally {
            dbSpan.end();
        }
    }

    private long countClickEvents() {
        Span dbSpan = tracer.spanBuilder("database read: demo_click_events count")
                .setSpanKind(SpanKind.CLIENT)
                .setAttribute("db.system", "postgresql")
                .setAttribute("db.operation", "SELECT")
                .setAttribute("db.sql.table", "demo_click_events")
                .startSpan();

        try (Scope ignored = dbSpan.makeCurrent()) {
            long count = repository.count();
            dbSpan.setAttribute("demo.total_events", count);
            return count;
        } finally {
            dbSpan.end();
        }
    }

    private String truncate(String value, int maxLength) {
        if (!StringUtils.hasText(value) || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
