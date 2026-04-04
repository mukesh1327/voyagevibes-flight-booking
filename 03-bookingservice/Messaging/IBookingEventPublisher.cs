namespace bookingservice.Messaging;

public interface IBookingEventPublisher
{
    Task PublishAsync(BookingEvent bookingEvent, CancellationToken cancellationToken = default);
}
