using bookingservice.Domain;

namespace bookingservice.Application;

public record ReserveBookingRequest(string FlightId, int SeatCount);
public record ChangeBookingRequest(string? NewFlightId, int? NewSeatCount);
public record BookingListResponse(int Count, IReadOnlyCollection<Booking> Items);
public record HealthResponse(string Status, HealthDetailsResponse Details);
public record HealthDetailsResponse(
    string Mode,
    string Service,
    string Storage,
    string ActiveEnv,
    long PublishedBookingEvents,
    long FailedBookingPublishes,
    long ConsumedInventoryEvents,
    long FailedInventoryEvents,
    long ConsumedPaymentEvents,
    long FailedPaymentEvents);
