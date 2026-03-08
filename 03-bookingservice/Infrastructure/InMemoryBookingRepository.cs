using System.Collections.Concurrent;
using bookingservice.Domain;

namespace bookingservice.Infrastructure;

public class InMemoryBookingRepository : IBookingRepository
{
    private readonly ConcurrentDictionary<string, Booking> _store = new();

    public Booking Save(Booking booking)
    {
        _store[booking.BookingId] = booking;
        return booking;
    }

    public Booking? FindById(string bookingId)
    {
        _store.TryGetValue(bookingId, out var booking);
        return booking;
    }

    public IReadOnlyCollection<Booking> FindAll() => _store.Values.ToList();
}
