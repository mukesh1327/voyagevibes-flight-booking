using System.Collections.Concurrent;
using bookingservice.Domain;

namespace bookingservice.Infrastructure;

public class InMemoryBookingRepository : IBookingRepository
{
    private readonly ConcurrentDictionary<string, Booking> _store = new();
    private readonly ConcurrentDictionary<string, OutboxState> _outbox = new();

    public string StorageName => "in-memory";

    public Booking Save(Booking booking)
    {
        _store[booking.BookingId] = booking;
        return booking;
    }

    public Booking SaveWithOutbox(Booking booking, OutboxEvent outboxEvent)
    {
        _store[booking.BookingId] = booking;
        _outbox.TryAdd(outboxEvent.EventId, new OutboxState(outboxEvent));
        return booking;
    }

    public Booking? FindById(string bookingId)
    {
        _store.TryGetValue(bookingId, out var booking);
        return booking;
    }

    public IReadOnlyCollection<Booking> FindAll() => _store.Values.ToList();

    public IReadOnlyCollection<OutboxEvent> GetPendingOutbox(int maxCount)
    {
        var pending = _outbox.Values
            .Where(state => state.PublishedAt is null && state.PoisonedAt is null)
            .OrderBy(state => state.Event.CreatedAt)
            .Take(Math.Max(1, maxCount))
            .ToList();

        var now = DateTimeOffset.UtcNow;
        foreach (var state in pending)
        {
            state.PublishAttempts++;
            state.LastAttemptAt = now;
        }

        return pending.Select(state => state.Event with { PublishAttempts = state.PublishAttempts }).ToList();
    }

    public void MarkOutboxPublished(string eventId, DateTimeOffset publishedAt)
    {
        if (_outbox.TryGetValue(eventId, out var state))
        {
            state.PublishedAt = publishedAt;
            state.LastError = null;
        }
    }

    public void MarkOutboxFailed(string eventId, string error, DateTimeOffset failedAt)
    {
        if (_outbox.TryGetValue(eventId, out var state))
        {
            state.LastAttemptAt = failedAt;
            state.LastError = error;
        }
    }

    public void MarkOutboxPoisoned(string eventId, string error, DateTimeOffset poisonedAt)
    {
        if (_outbox.TryGetValue(eventId, out var state))
        {
            state.PoisonedAt = poisonedAt;
            state.LastError = error;
        }
    }

    private sealed class OutboxState
    {
        public OutboxState(OutboxEvent @event)
        {
            Event = @event;
        }

        public OutboxEvent Event { get; }
        public int PublishAttempts { get; set; }
        public DateTimeOffset? PublishedAt { get; set; }
        public DateTimeOffset? LastAttemptAt { get; set; }
        public string? LastError { get; set; }
        public DateTimeOffset? PoisonedAt { get; set; }
    }
}
