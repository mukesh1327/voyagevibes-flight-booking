namespace bookingservice.Infrastructure;

public class FlightServiceOptions
{
    public string BaseUrl { get; set; } = "http://localhost:8082";
    public bool AllowInsecureTls { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 8;
}
