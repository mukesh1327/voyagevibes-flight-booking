using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;

namespace bookingservice.Messaging;

public class KafkaBookingEventPublisher : IBookingEventPublisher, IDisposable
{
    private readonly ILogger<KafkaBookingEventPublisher> _logger;
    private readonly BookingKafkaMetrics _metrics;
    private readonly KafkaOptions _options;
    private readonly IProducer<string, string>? _producer;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public KafkaBookingEventPublisher(
        IOptions<KafkaOptions> options,
        BookingKafkaMetrics metrics,
        ILogger<KafkaBookingEventPublisher> logger)
    {
        _options = options.Value;
        _metrics = metrics;
        _logger = logger;

        if (!_options.Enabled)
        {
            return;
        }

        var config = new ProducerConfig
        {
            BootstrapServers = _options.BootstrapServers,
            Acks = Acks.Leader
        };

        _producer = new ProducerBuilder<string, string>(config).Build();
    }

    public async Task PublishAsync(BookingEvent bookingEvent, CancellationToken cancellationToken = default)
    {
        if (_producer is null)
        {
            throw new InvalidOperationException("Kafka producer is not initialized.");
        }

        try
        {
            var payload = JsonSerializer.Serialize(bookingEvent, _jsonOptions);
            var message = new Message<string, string>
            {
                Key = bookingEvent.BookingId ?? string.Empty,
                Value = payload
            };

            await _producer.ProduceAsync(_options.BookingEventsTopic, message, cancellationToken);
            _metrics.IncrementPublishedBookingEvents();
        }
        catch (Exception ex)
        {
            _metrics.IncrementFailedBookingPublishes();
            _logger.LogError(ex, "Failed to publish booking event: {EventType} for {BookingId}", bookingEvent.EventType, bookingEvent.BookingId);
            throw;
        }
    }

    public void Dispose()
    {
        if (_producer is null)
        {
            return;
        }

        try
        {
            _producer.Flush(TimeSpan.FromSeconds(2));
        }
        catch
        {
            // Ignore flush failures during shutdown.
        }
        finally
        {
            _producer.Dispose();
        }
    }
}
