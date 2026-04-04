package com.cloudxplorer.flightservice.messaging;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.concurrent.atomic.AtomicLong;

@ApplicationScoped
public class KafkaFlowMetrics {

  private final AtomicLong publishedInventoryEvents = new AtomicLong();
  private final AtomicLong failedInventoryPublishes = new AtomicLong();
  private final AtomicLong consumedBookingEvents = new AtomicLong();
  private final AtomicLong failedBookingEvents = new AtomicLong();

  public long incrementPublishedInventoryEvents() {
    return publishedInventoryEvents.incrementAndGet();
  }

  public long incrementFailedInventoryPublishes() {
    return failedInventoryPublishes.incrementAndGet();
  }

  public long incrementConsumedBookingEvents() {
    return consumedBookingEvents.incrementAndGet();
  }

  public long incrementFailedBookingEvents() {
    return failedBookingEvents.incrementAndGet();
  }

  public long publishedInventoryEvents() {
    return publishedInventoryEvents.get();
  }

  public long failedInventoryPublishes() {
    return failedInventoryPublishes.get();
  }

  public long consumedBookingEvents() {
    return consumedBookingEvents.get();
  }

  public long failedBookingEvents() {
    return failedBookingEvents.get();
  }
}
