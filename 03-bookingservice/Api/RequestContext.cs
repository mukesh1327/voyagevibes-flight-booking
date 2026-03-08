using bookingservice.Domain;

namespace bookingservice.Api;

public static class RequestContext
{
    public static string UserId(HttpRequest request)
    {
        return request.Headers.TryGetValue("X-User-Id", out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.ToString()
            : "U-DEFAULT";
    }

    public static ActorType ActorType(HttpRequest request)
    {
        var actorHeader = request.Headers.TryGetValue("X-Actor-Type", out var actorTypeValue)
            ? actorTypeValue.ToString()
            : null;
        var realmHeader = request.Headers.TryGetValue("X-Realm", out var realmValue)
            ? realmValue.ToString()
            : null;

        return ActorTypeExtensions.FromContext(actorHeader, realmHeader);
    }

    public static string CorrelationId(HttpRequest request)
    {
        if (request.Headers.TryGetValue("X-Correlation-Id", out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return value.ToString();
        }

        return Guid.NewGuid().ToString("N");
    }
}
