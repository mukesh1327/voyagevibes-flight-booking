namespace FlightService;

public sealed class Flight
{
    public Guid Id { get; set; }
    public string FlightNo { get; set; } = string.Empty;
    public string Origin { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public DateTime DepartureTime { get; set; }
    public DateTime ArrivalTime { get; set; }
    public decimal Price { get; set; }
    public int SeatsAvailable { get; set; }
}
