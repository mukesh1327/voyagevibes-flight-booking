using Microsoft.EntityFrameworkCore;

namespace FlightService;

public static class FlightSeeder
{
    public static async Task SeedAsync(FlightDbContext db)
    {
        var serviceDate = DateTime.UtcNow.Date.AddDays(1);
        var nextDate = serviceDate.AddDays(1);

        if (await db.Flights.AnyAsync(flight => flight.DepartureTime >= serviceDate && flight.DepartureTime < nextDate))
        {
            return;
        }

        var routes = new[]
        {
            Flight("VV101", "DEL", "BOM", serviceDate.AddHours(7), 5400, 18),
            Flight("VV102", "DEL", "BOM", serviceDate.AddHours(11), 6200, 9),
            Flight("VV201", "BOM", "BLR", serviceDate.AddHours(8), 4800, 14),
            Flight("VV301", "BLR", "DEL", serviceDate.AddHours(9), 7100, 22),
            Flight("VV401", "DEL", "HYD", serviceDate.AddHours(10), 3900, 11),
            Flight("VV501", "HYD", "BOM", serviceDate.AddHours(12), 4200, 16),
            Flight("VV601", "MAA", "DEL", serviceDate.AddHours(6), 7600, 7),
            Flight("VV701", "DEL", "GOI", serviceDate.AddHours(13), 6800, 20),
        };

        db.Flights.AddRange(routes);
        await db.SaveChangesAsync();
    }

    private static Flight Flight(string no, string origin, string destination, DateTime departure, decimal price, int seats) => new()
    {
        Id = Guid.NewGuid(),
        FlightNo = no,
        Origin = origin,
        Destination = destination,
        DepartureTime = departure,
        ArrivalTime = departure.AddHours(2),
        Price = price,
        SeatsAvailable = seats,
    };
}
