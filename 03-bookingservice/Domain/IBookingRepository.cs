namespace bookingservice.Domain;

public interface IBookingRepository
{
    string StorageName { get; }
    Booking Save(Booking booking);
    Booking SaveWithOutbox(Booking booking, OutboxEvent outboxEvent);
    Booking? FindById(string bookingId);
    IReadOnlyCollection<Booking> FindAll();
    IReadOnlyCollection<OutboxEvent> GetPendingOutbox(int maxCount);
    void MarkOutboxPublished(string eventId, DateTimeOffset publishedAt);
    void MarkOutboxFailed(string eventId, string error, DateTimeOffset failedAt);
    void MarkOutboxPoisoned(string eventId, string error, DateTimeOffset poisonedAt);
}
