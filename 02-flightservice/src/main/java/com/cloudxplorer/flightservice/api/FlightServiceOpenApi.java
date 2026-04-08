package com.cloudxplorer.flightservice.api;

import org.eclipse.microprofile.openapi.annotations.OpenAPIDefinition;
import org.eclipse.microprofile.openapi.annotations.info.Info;
import org.eclipse.microprofile.openapi.annotations.servers.Server;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@OpenAPIDefinition(
    info =
        @Info(
            title = "VoyageVibes Flight Service API",
            version = "1.0.0",
            description =
                "Flight search, availability, pricing, and inventory hold APIs for VoyageVibes. "
                    + "This service uses MySQL for flight catalog and seat inventory, publishes Kafka "
                    + "events to flight.inventory.events, and consumes booking.events for booking-driven "
                    + "release and commit flows."),
    servers = @Server(url = "/", description = "Current deployment"),
    tags = {
      @Tag(name = "Flights", description = "Flight search and flight detail endpoints backed by inventory data."),
      @Tag(name = "Pricing", description = "Fare quote calculation for selected flights."),
      @Tag(name = "Inventory", description = "Seat hold lifecycle endpoints that also emit Kafka inventory events."),
      @Tag(name = "Health", description = "Operational health probes and dependency counters.")
    })
public class FlightServiceOpenApi {}
