using System.Text.Json;
using bookingservice.Domain;
using Microsoft.Extensions.Options;

namespace bookingservice.Messaging;

public class BookingOutboxPublisherService : BackgroundService
{
    private readonly IBookingRepository _repository;
    private readonly IBookingEventPublisher _publisher;
    private readonly ILogger<BookingOutboxPublisherService> _logger;
    private readonly KafkaOptions _kafkaOptions;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(2);
    private const int BatchSize = 20;
    private const int MaxAttempts = 5;

    public BookingOutboxPublisherService(
        IBookingRepository repository,
        IBookingEventPublisher publisher,
        IOptions<KafkaOptions> kafkaOptions,
        ILogger<BookingOutboxPublisherService> logger)
    {
        _repository = repository;
        _publisher = publisher;
        _logger = logger;
        _kafkaOptions = kafkaOptions.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            if (!_kafkaOptions.Enabled)
            {
                await Task.Delay(_pollInterval, stoppingToken);
                continue;
            }

            IReadOnlyCollection<OutboxEvent> pending;
            try
            {
                pending = _repository.GetPendingOutbox(BatchSize);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed reading booking outbox.");
                await Task.Delay(_pollInterval, stoppingToken);
                continue;
            }

            if (pending.Count == 0)
            {
                await Task.Delay(_pollInterval, stoppingToken);
                continue;
            }

            foreach (var outboxEvent in pending)
            {
                if (outboxEvent.PublishAttempts >= MaxAttempts)
                {
                    _repository.MarkOutboxPoisoned(outboxEvent.EventId, "max attempts exceeded", DateTimeOffset.UtcNow);
                    continue;
                }

                try
                {
                    var bookingEvent = JsonSerializer.Deserialize<BookingEvent>(outboxEvent.Payload, _jsonOptions);
                    if (bookingEvent is null)
                    {
                        throw new InvalidOperationException("Outbox payload could not be deserialized.");
                    }

                    await _publisher.PublishAsync(bookingEvent, stoppingToken);
                    _repository.MarkOutboxPublished(outboxEvent.EventId, DateTimeOffset.UtcNow);
                }
                catch (Exception ex)
                {
                    _repository.MarkOutboxFailed(outboxEvent.EventId, ex.Message, DateTimeOffset.UtcNow);
                    _logger.LogError(ex, "Failed publishing outbox event {EventId}.", outboxEvent.EventId);
                    var delaySeconds = Math.Min(60, (int)Math.Pow(2, Math.Max(1, outboxEvent.PublishAttempts)));
                    await Task.Delay(TimeSpan.FromSeconds(delaySeconds), stoppingToken);
                }
            }
        }
    }
}
