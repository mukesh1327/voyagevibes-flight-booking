package com.cloudxplorer.flightservice.messaging;

import com.cloudxplorer.flightservice.application.FlightApplicationService;
import io.smallrye.common.annotation.Blocking;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.jboss.logging.Logger;

@ApplicationScoped
public class BookingEventConsumer {

  private static final Logger LOG = Logger.getLogger(BookingEventConsumer.class);

  private final FlightApplicationService flightApplicationService;
  private final KafkaFlowMetrics metrics;

  public BookingEventConsumer(
      FlightApplicationService flightApplicationService,
      KafkaFlowMetrics metrics) {
    this.flightApplicationService = flightApplicationService;
    this.metrics = metrics;
  }

  @Incoming("booking-events")
  @Blocking
  public void onBookingEvent(BookingEvent event) {
    metrics.incrementConsumedBookingEvents();

    if (event == null || event.eventType() == null || event.eventType().isBlank()) {
      metrics.incrementFailedBookingEvents();
      LOG.warn("received invalid booking event payload");
      return;
    }

    String eventType = event.eventType().trim().toUpperCase();
    try {
      switch (eventType) {
        case "BOOKING_CANCELLED", "BOOKING_CANCELED" -> flightApplicationService.releaseFromBookingEvent(event);
        case "BOOKING_CONFIRMED" -> flightApplicationService.commitFromBookingEvent(event);
        default -> LOG.debugf("booking event ignored by flight-service: type=%s, bookingId=%s", eventType, event.bookingId());
      }
    } catch (Exception ex) {
      metrics.incrementFailedBookingEvents();
      LOG.errorf(ex, "failed processing booking event: %s", event);
    }
  }
}
