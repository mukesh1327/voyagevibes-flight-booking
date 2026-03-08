package com.cloudxplorer.flightservice.messaging;

import io.smallrye.reactive.messaging.kafka.api.OutgoingKafkaRecordMetadata;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.reactive.messaging.Channel;
import org.eclipse.microprofile.reactive.messaging.Emitter;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.jboss.logging.Logger;

@ApplicationScoped
public class InventoryEventPublisher {

  private static final Logger LOG = Logger.getLogger(InventoryEventPublisher.class);

  private final Emitter<InventoryEvent> emitter;
  private final KafkaFlowMetrics metrics;

  public InventoryEventPublisher(
      @Channel("flight-inventory-events") Emitter<InventoryEvent> emitter,
      KafkaFlowMetrics metrics) {
    this.emitter = emitter;
    this.metrics = metrics;
  }

  public void publish(InventoryEvent event) {
    try {
      Message<InventoryEvent> message =
          Message.of(event)
              .addMetadata(
                  OutgoingKafkaRecordMetadata.<String>builder()
                      .withKey(event.flightId() == null ? "" : event.flightId())
                      .build());
      emitter.send(message);
      metrics.incrementPublishedInventoryEvents();
    } catch (Exception ex) {
      metrics.incrementFailedInventoryPublishes();
      LOG.errorf(ex, "failed to publish inventory event: %s", event);
    }
  }
}
