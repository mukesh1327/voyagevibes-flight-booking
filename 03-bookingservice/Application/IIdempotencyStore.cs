using bookingservice.Domain;

namespace bookingservice.Application;

public interface IIdempotencyStore
{
    IdempotencyRecord? Get(string key, string scope);
    bool TrySave(IdempotencyRecord record);
}
