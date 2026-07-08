namespace FlightService;

public sealed record FlightDto(
    Guid Id,
    string FlightNo,
    string Origin,
    string Destination,
    DateTime DepartureTime,
    DateTime ArrivalTime,
    decimal Price,
    int SeatsAvailable)
{
    public static FlightDto From(Flight flight) => new(
        flight.Id,
        flight.FlightNo,
        flight.Origin,
        flight.Destination,
        flight.DepartureTime,
        flight.ArrivalTime,
        flight.Price,
        flight.SeatsAvailable);
}
