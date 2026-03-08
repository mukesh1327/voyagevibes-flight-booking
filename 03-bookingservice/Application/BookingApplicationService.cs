using bookingservice.Domain;
using bookingservice.Messaging;
using Microsoft.Extensions.Options;

namespace bookingservice.Application;

public class BookingApplicationService
{
    private readonly IBookingRepository _repository;
    private readonly IFlightInventoryGateway _flightInventoryGateway;
    private readonly IBookingEventPublisher _bookingEventPublisher;
    private readonly BookingKafkaMetrics _kafkaMetrics;
    private readonly BookingServiceOptions _serviceOptions;

    public BookingApplicationService(
        IBookingRepository repository,
        IFlightInventoryGateway flightInventoryGateway,
        IBookingEventPublisher bookingEventPublisher,
        BookingKafkaMetrics kafkaMetrics,
        IOptions<BookingServiceOptions> serviceOptions)
    {
        _repository = repository;
        _flightInventoryGateway = flightInventoryGateway;
        _bookingEventPublisher = bookingEventPublisher;
        _kafkaMetrics = kafkaMetrics;
        _serviceOptions = serviceOptions.Value;
    }

    public async Task<Booking> ReserveAsync(string userId, ActorType actorType, ReserveBookingRequest request, string correlationId, CancellationToken cancellationToken = default)
    {
        ValidateReserve(request);

        var bookingId = BuildBookingId();
        var hold = await _flightInventoryGateway.HoldAsync(
            bookingId,
            request.FlightId.Trim(),
            request.SeatCount,
            actorType,
            userId,
            correlationId,
            cancellationToken);

        var booking = new Booking(
            BookingId: bookingId,
            UserId: userId,
            FlightId: request.FlightId.Trim(),
            SeatCount: request.SeatCount,
            Status: "RESERVED",
            PaymentStatus: "PENDING",
            HoldId: hold.HoldId,
            ActorType: actorType.HeaderValue(),
            UpdatedAt: DateTimeOffset.UtcNow);

        _repository.Save(booking);
        await PublishBookingEventAsync("BOOKING_RESERVED", booking, cancellationToken);
        return booking;
    }

    public async Task<Booking> ConfirmAsync(string bookingId, string userId, ActorType actorType, string correlationId, CancellationToken cancellationToken = default)
    {
        var booking = GetAuthorizedBooking(bookingId, userId, actorType);
        EnsureStatusTransitionAllowed(booking.Status, "CONFIRMED");

        if (!string.IsNullOrWhiteSpace(booking.HoldId))
        {
            await _flightInventoryGateway.CommitAsync(
                booking.BookingId,
                booking.HoldId,
                actorType,
                userId,
                correlationId,
                cancellationToken);
        }

        var confirmed = booking with
        {
            Status = "CONFIRMED",
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _repository.Save(confirmed);
        await PublishBookingEventAsync("BOOKING_CONFIRMED", confirmed, cancellationToken);
        return confirmed;
    }

    public Booking GetOne(string bookingId, string userId, ActorType actorType)
    {
        return GetAuthorizedBooking(bookingId, userId, actorType);
    }

    public BookingListResponse GetMany(string userId, ActorType actorType)
    {
        var list = _repository
            .FindAll()
            .Where(x => actorType == ActorType.Corp || x.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(x => x.UpdatedAt)
            .ToList();

        return new BookingListResponse(list.Count, list);
    }

    public async Task<Booking> CancelAsync(string bookingId, string userId, ActorType actorType, string correlationId, CancellationToken cancellationToken = default)
    {
        var booking = GetAuthorizedBooking(bookingId, userId, actorType);
        if (string.Equals(booking.Status, "CANCELLED", StringComparison.OrdinalIgnoreCase))
        {
            return booking;
        }

        if (!string.IsNullOrWhiteSpace(booking.HoldId))
        {
            await _flightInventoryGateway.ReleaseAsync(
                booking.BookingId,
                booking.HoldId,
                actorType,
                userId,
                correlationId,
                cancellationToken);
        }

        var cancelled = booking with
        {
            Status = "CANCELLED",
            PaymentStatus = string.Equals(booking.PaymentStatus, "CAPTURED", StringComparison.OrdinalIgnoreCase)
                ? "REFUND_PENDING"
                : booking.PaymentStatus,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _repository.Save(cancelled);
        await PublishBookingEventAsync("BOOKING_CANCELLED", cancelled, cancellationToken);
        return cancelled;
    }

    public async Task<Booking> ChangeAsync(string bookingId, string userId, ActorType actorType, ChangeBookingRequest request, string correlationId, CancellationToken cancellationToken = default)
    {
        if (request is null)
        {
            throw new ArgumentException("request body is required");
        }

        var booking = GetAuthorizedBooking(bookingId, userId, actorType);
        EnsureStatusTransitionAllowed(booking.Status, "CHANGED");

        var targetFlightId = string.IsNullOrWhiteSpace(request.NewFlightId) ? booking.FlightId : request.NewFlightId.Trim();
        var targetSeatCount = request.NewSeatCount ?? booking.SeatCount;
        if (targetSeatCount <= 0)
        {
            throw new ArgumentException("newSeatCount must be greater than zero");
        }

        if (!string.IsNullOrWhiteSpace(booking.HoldId))
        {
            await _flightInventoryGateway.ReleaseAsync(
                booking.BookingId,
                booking.HoldId,
                actorType,
                userId,
                correlationId,
                cancellationToken);
        }

        var replacementHold = await _flightInventoryGateway.HoldAsync(
            booking.BookingId,
            targetFlightId,
            targetSeatCount,
            actorType,
            userId,
            correlationId,
            cancellationToken);

        var changed = booking with
        {
            FlightId = targetFlightId,
            SeatCount = targetSeatCount,
            HoldId = replacementHold.HoldId,
            Status = "CHANGED",
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _repository.Save(changed);
        await PublishBookingEventAsync("BOOKING_CHANGED", changed, cancellationToken);
        return changed;
    }

    public Task ApplyInventoryEventAsync(InventoryEvent inventoryEvent, CancellationToken cancellationToken = default)
    {
        if (inventoryEvent is null || string.IsNullOrWhiteSpace(inventoryEvent.BookingId))
        {
            return Task.CompletedTask;
        }

        var booking = _repository.FindById(inventoryEvent.BookingId.Trim());
        if (booking is null)
        {
            return Task.CompletedTask;
        }

        var eventType = inventoryEvent.EventType?.Trim().ToUpperInvariant() ?? string.Empty;
        var next = eventType switch
        {
            "INVENTORY_COMMITTED" => booking with
            {
                Status = string.Equals(booking.Status, "CANCELLED", StringComparison.OrdinalIgnoreCase) ? booking.Status : "CONFIRMED",
                UpdatedAt = DateTimeOffset.UtcNow
            },
            "INVENTORY_RELEASED" or "INVENTORY_EXPIRED" => booking with
            {
                Status = string.Equals(booking.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase) ? booking.Status : "CANCELLED",
                UpdatedAt = DateTimeOffset.UtcNow
            },
            _ => booking
        };

        if (!ReferenceEquals(next, booking))
        {
            _repository.Save(next);
        }

        return Task.CompletedTask;
    }

    public Task ApplyPaymentEventAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken = default)
    {
        if (paymentEvent is null || string.IsNullOrWhiteSpace(paymentEvent.BookingId))
        {
            return Task.CompletedTask;
        }

        var booking = _repository.FindById(paymentEvent.BookingId.Trim());
        if (booking is null)
        {
            return Task.CompletedTask;
        }

        var eventType = paymentEvent.EventType?.Trim().ToUpperInvariant() ?? string.Empty;
        var paymentStatus = eventType switch
        {
            "PAYMENT_INTENT_CREATED" => "INTENT_CREATED",
            "PAYMENT_AUTHORIZED" => "AUTHORIZED",
            "PAYMENT_CAPTURED" => "CAPTURED",
            "PAYMENT_REFUNDED" => "REFUNDED",
            "PAYMENT_FAILED" => "FAILED",
            _ => booking.PaymentStatus
        };

        if (string.Equals(paymentStatus, booking.PaymentStatus, StringComparison.OrdinalIgnoreCase))
        {
            return Task.CompletedTask;
        }

        _repository.Save(booking with
        {
            PaymentStatus = paymentStatus,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        return Task.CompletedTask;
    }

    public object Health(string mode)
    {
        return new
        {
            status = "UP",
            details = new
            {
                mode,
                service = "booking-service",
                storage = "in-memory",
                activeEnv = _serviceOptions.ActiveEnv,
                publishedBookingEvents = _kafkaMetrics.PublishedBookingEvents,
                failedBookingPublishes = _kafkaMetrics.FailedBookingPublishes,
                consumedInventoryEvents = _kafkaMetrics.ConsumedInventoryEvents,
                failedInventoryEvents = _kafkaMetrics.FailedInventoryEvents,
                consumedPaymentEvents = _kafkaMetrics.ConsumedPaymentEvents,
                failedPaymentEvents = _kafkaMetrics.FailedPaymentEvents
            }
        };
    }

    private Booking GetAuthorizedBooking(string bookingId, string userId, ActorType actorType)
    {
        var booking = _repository.FindById(bookingId);
        if (booking is null)
        {
            throw new KeyNotFoundException($"booking not found: {bookingId}");
        }

        if (actorType == ActorType.Corp)
        {
            return booking;
        }

        if (!booking.UserId.Equals(userId, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("customer cannot access another user's booking");
        }

        return booking;
    }

    private async Task PublishBookingEventAsync(string eventType, Booking booking, CancellationToken cancellationToken)
    {
        await _bookingEventPublisher.PublishAsync(
            new BookingEvent(
                EventId: Guid.NewGuid().ToString("N"),
                EventType: eventType,
                OccurredAt: DateTimeOffset.UtcNow.ToString("O"),
                BookingId: booking.BookingId,
                HoldId: booking.HoldId,
                FlightId: booking.FlightId,
                SeatCount: booking.SeatCount,
                UserId: booking.UserId,
                ActorType: booking.ActorType),
            cancellationToken);
    }

    private static void ValidateReserve(ReserveBookingRequest request)
    {
        if (request is null)
        {
            throw new ArgumentException("request body is required");
        }

        if (string.IsNullOrWhiteSpace(request.FlightId))
        {
            throw new ArgumentException("flightId is required");
        }

        if (request.SeatCount <= 0)
        {
            throw new ArgumentException("seatCount must be greater than zero");
        }
    }

    private static void EnsureStatusTransitionAllowed(string currentStatus, string targetStatus)
    {
        if (string.Equals(currentStatus, "CANCELLED", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(targetStatus, "CANCELLED", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("cancelled booking cannot be modified");
        }
    }

    private static string BuildBookingId() => $"BKG-{Guid.NewGuid():N}"[..16].ToUpperInvariant();
}
