using System.Threading;

namespace bookingservice.Messaging;

public class BookingKafkaMetrics
{
    private long _publishedBookingEvents;
    private long _failedBookingPublishes;
    private long _consumedInventoryEvents;
    private long _failedInventoryEvents;
    private long _consumedPaymentEvents;
    private long _failedPaymentEvents;

    public long PublishedBookingEvents => Interlocked.Read(ref _publishedBookingEvents);
    public long FailedBookingPublishes => Interlocked.Read(ref _failedBookingPublishes);
    public long ConsumedInventoryEvents => Interlocked.Read(ref _consumedInventoryEvents);
    public long FailedInventoryEvents => Interlocked.Read(ref _failedInventoryEvents);
    public long ConsumedPaymentEvents => Interlocked.Read(ref _consumedPaymentEvents);
    public long FailedPaymentEvents => Interlocked.Read(ref _failedPaymentEvents);

    public void IncrementPublishedBookingEvents() => Interlocked.Increment(ref _publishedBookingEvents);
    public void IncrementFailedBookingPublishes() => Interlocked.Increment(ref _failedBookingPublishes);
    public void IncrementConsumedInventoryEvents() => Interlocked.Increment(ref _consumedInventoryEvents);
    public void IncrementFailedInventoryEvents() => Interlocked.Increment(ref _failedInventoryEvents);
    public void IncrementConsumedPaymentEvents() => Interlocked.Increment(ref _consumedPaymentEvents);
    public void IncrementFailedPaymentEvents() => Interlocked.Increment(ref _failedPaymentEvents);
}
