using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using bookingservice.Application;
using bookingservice.Domain;

namespace bookingservice.Infrastructure;

public class FlightInventoryGateway : IFlightInventoryGateway
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<FlightInventoryGateway> _logger;

    public FlightInventoryGateway(HttpClient httpClient, ILogger<FlightInventoryGateway> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<FlightInventoryResult> HoldAsync(
        string bookingId,
        string flightId,
        int seatCount,
        ActorType actorType,
        string userId,
        string correlationId,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            bookingId,
            flightId,
            seatCount
        };

        return await SendAsync(
            "/api/v1/inventory/hold",
            payload,
            actorType,
            userId,
            correlationId,
            cancellationToken);
    }

    public async Task<FlightInventoryResult> CommitAsync(
        string bookingId,
        string holdId,
        ActorType actorType,
        string userId,
        string correlationId,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            bookingId,
            holdId
        };

        return await SendAsync(
            "/api/v1/inventory/commit",
            payload,
            actorType,
            userId,
            correlationId,
            cancellationToken);
    }

    public async Task<FlightInventoryResult> ReleaseAsync(
        string bookingId,
        string holdId,
        ActorType actorType,
        string userId,
        string correlationId,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            bookingId,
            holdId
        };

        return await SendAsync(
            "/api/v1/inventory/release",
            payload,
            actorType,
            userId,
            correlationId,
            cancellationToken);
    }

    private async Task<FlightInventoryResult> SendAsync(
        string path,
        object payload,
        ActorType actorType,
        string userId,
        string correlationId,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Content = JsonContent.Create(payload);
        request.Headers.Add("X-Actor-Type", actorType.HeaderValue());
        request.Headers.Add("X-User-Id", userId);
        request.Headers.Add("X-Correlation-Id", correlationId);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var message = $"flight-service call failed ({response.StatusCode}) for {path}";
            if (!string.IsNullOrWhiteSpace(errorBody))
            {
                message += $": {errorBody}";
            }

            _logger.LogWarning("Flight inventory call failed: {Message}", message);
            throw BuildException(response.StatusCode, message);
        }

        var doc = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: cancellationToken);
        if (doc is null)
        {
            throw new InvalidOperationException("flight-service returned empty response");
        }

        var root = doc.RootElement;
        var holdId = TryGetString(root, "holdId");
        var status = TryGetString(root, "status");

        if (string.IsNullOrWhiteSpace(holdId))
        {
            throw new InvalidOperationException("flight-service response missing holdId");
        }

        return new FlightInventoryResult(holdId, status);
    }

    private static Exception BuildException(HttpStatusCode statusCode, string message)
    {
        return statusCode switch
        {
            HttpStatusCode.NotFound => new KeyNotFoundException(message),
            HttpStatusCode.Forbidden => new UnauthorizedAccessException(message),
            HttpStatusCode.BadRequest => new ArgumentException(message),
            HttpStatusCode.Conflict => new InvalidOperationException(message),
            _ => new InvalidOperationException(message)
        };
    }

    private static string TryGetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
        {
            return string.Empty;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => value.ToString()
        };
    }
}
