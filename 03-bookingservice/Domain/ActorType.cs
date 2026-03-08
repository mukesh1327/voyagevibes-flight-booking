namespace bookingservice.Domain;

public enum ActorType
{
    Customer,
    Corp
}

public static class ActorTypeExtensions
{
    public static ActorType FromContext(string? actorTypeHeader, string? realmHeader)
    {
        if (string.Equals(Trim(actorTypeHeader), "corp", StringComparison.OrdinalIgnoreCase))
        {
            return ActorType.Corp;
        }

        if (string.Equals(Trim(actorTypeHeader), "customer", StringComparison.OrdinalIgnoreCase))
        {
            return ActorType.Customer;
        }

        var realm = Trim(realmHeader);
        if (string.Equals(realm, "corp", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(realm, "voyagevibes-corp", StringComparison.OrdinalIgnoreCase))
        {
            return ActorType.Corp;
        }

        return ActorType.Customer;
    }

    public static string HeaderValue(this ActorType actorType) => actorType == ActorType.Corp ? "corp" : "customer";

    private static string Trim(string? value) => value?.Trim() ?? string.Empty;
}
