using bookingservice.Domain;

namespace bookingservice.Application;

public record ReserveBookingRequest(string FlightId, int SeatCount);
public record ChangeBookingRequest(string? NewFlightId, int? NewSeatCount);
public record BookingListResponse(int Count, IReadOnlyCollection<Booking> Items);
