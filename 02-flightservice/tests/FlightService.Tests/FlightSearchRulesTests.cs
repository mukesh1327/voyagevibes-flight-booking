namespace FlightService.Tests;

public sealed class FlightSearchRulesTests
{
    [Fact]
    public void AirportCodesAreComparedCaseInsensitively()
    {
        Assert.Equal("DEL", " del ".Trim().ToUpperInvariant());
    }

    [Theory]
    [InlineData("DEL", true)]
    [InlineData(" del ", true)]
    [InlineData("D1L", false)]
    [InlineData("DELI", false)]
    [InlineData("", false)]
    public void AirportCodeValidationRequiresThreeLetters(string code, bool expected)
    {
        Assert.Equal(expected, FlightService.FlightSearchService.IsValidAirportCode(code));
    }

    [Theory]
    [InlineData(1, true)]
    [InlineData(6, true)]
    [InlineData(0, false)]
    [InlineData(7, false)]
    public void SeatHoldValidationKeepsCheckoutSmall(int seats, bool expected)
    {
        Assert.Equal(expected, FlightService.FlightSearchService.IsValidSeatCount(seats));
    }

    [Fact]
    public void FlightUpdateRequestRejectsInvalidOperationalChanges()
    {
        var request = new FlightService.Endpoints.FlightUpdateRequest(
            null,
            "D1L",
            null,
            DateTime.UtcNow.AddHours(3),
            DateTime.UtcNow.AddHours(1),
            -10,
            -1);

        Assert.Equal("origin must be a 3-letter airport code", request.Validate());
    }

    [Fact]
    public void FlightUpdateRequestNormalizesAdminEdits()
    {
        var flight = new FlightService.Flight
        {
            FlightNo = "VV100",
            Origin = "DEL",
            Destination = "BLR",
            DepartureTime = DateTime.UtcNow,
            ArrivalTime = DateTime.UtcNow.AddHours(2),
            Price = 5000,
            SeatsAvailable = 20,
        };
        var updatedDeparture = DateTime.UtcNow.AddDays(1);
        var updatedArrival = updatedDeparture.AddHours(2);
        var request = new FlightService.Endpoints.FlightUpdateRequest(
            " vv321 ",
            " bom ",
            " hyd ",
            updatedDeparture,
            updatedArrival,
            6200,
            14);

        request.ApplyTo(flight);

        Assert.Equal("VV321", flight.FlightNo);
        Assert.Equal("BOM", flight.Origin);
        Assert.Equal("HYD", flight.Destination);
        Assert.Equal(6200, flight.Price);
        Assert.Equal(14, flight.SeatsAvailable);
    }
}
