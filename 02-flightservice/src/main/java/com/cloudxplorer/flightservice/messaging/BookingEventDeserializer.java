package com.cloudxplorer.flightservice.messaging;

import io.quarkus.kafka.client.serialization.ObjectMapperDeserializer;

public class BookingEventDeserializer extends ObjectMapperDeserializer<BookingEvent> {
  public BookingEventDeserializer() {
    super(BookingEvent.class);
  }
}
