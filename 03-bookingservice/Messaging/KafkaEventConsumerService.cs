using System.Text.Json;
using bookingservice.Application;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Options;

namespace bookingservice.Messaging;

public class KafkaEventConsumerService : BackgroundService
{
    private readonly BookingApplicationService _bookingApplicationService;
    private readonly BookingKafkaMetrics _metrics;
    private readonly KafkaOptions _options;
    private readonly ILogger<KafkaEventConsumerService> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private DateTimeOffset _lastMissingTopicLogAt = DateTimeOffset.MinValue;

    public KafkaEventConsumerService(
        BookingApplicationService bookingApplicationService,
        BookingKafkaMetrics metrics,
        IOptions<KafkaOptions> options,
        ILogger<KafkaEventConsumerService> logger)
    {
        _bookingApplicationService = bookingApplicationService;
        _metrics = metrics;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Kafka consumer is disabled for booking-service.");
            return;
        }

        var autoOffsetReset = AutoOffsetReset.Latest;
        if (Enum.TryParse<AutoOffsetReset>(_options.AutoOffsetReset, true, out var parsedOffset))
        {
            autoOffsetReset = parsedOffset;
        }

        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers = _options.BootstrapServers,
            GroupId = _options.ConsumerGroupId,
            AutoOffsetReset = autoOffsetReset,
            EnableAutoCommit = false
        };

        await EnsureTopicsIfConfiguredAsync(stoppingToken);

        using var consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
        consumer.Subscribe(new[] { _options.InventoryEventsTopic, _options.PaymentEventsTopic });

        _logger.LogInformation(
            "Kafka consumer started for booking-service. Topics: {InventoryTopic}, {PaymentTopic}",
            _options.InventoryEventsTopic,
            _options.PaymentEventsTopic);

        while (!stoppingToken.IsCancellationRequested)
        {
            ConsumeResult<string, string>? result = null;
            try
            {
                result = consumer.Consume(stoppingToken);
                if (result?.Message?.Value is null)
                {
                    continue;
                }

                await HandleMessageAsync(result.Topic, result.Message.Value, stoppingToken);
                consumer.Commit(result);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (ConsumeException ex)
            {
                if (IsMissingTopicError(ex))
                {
                    MaybeLogMissingTopic(ex);
                    await Task.Delay(Math.Max(500, _options.MissingTopicRetryDelayMs), stoppingToken);
                    continue;
                }

                _logger.LogWarning(ex, "Kafka consume exception in booking-service.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled booking-service Kafka consumer error.");
            }
        }

        consumer.Close();
    }

    private async Task HandleMessageAsync(string topic, string payload, CancellationToken cancellationToken)
    {
        if (topic.Equals(_options.InventoryEventsTopic, StringComparison.OrdinalIgnoreCase))
        {
            _metrics.IncrementConsumedInventoryEvents();
            try
            {
                var inventoryEvent = JsonSerializer.Deserialize<InventoryEvent>(payload, _jsonOptions);
                if (inventoryEvent is null || string.IsNullOrWhiteSpace(inventoryEvent.EventType))
                {
                    _metrics.IncrementFailedInventoryEvents();
                    _logger.LogWarning("Received invalid inventory event payload.");
                    return;
                }

                await _bookingApplicationService.ApplyInventoryEventAsync(inventoryEvent, cancellationToken);
            }
            catch (Exception ex)
            {
                _metrics.IncrementFailedInventoryEvents();
                _logger.LogError(ex, "Failed processing inventory event payload: {Payload}", payload);
            }

            return;
        }

        if (topic.Equals(_options.PaymentEventsTopic, StringComparison.OrdinalIgnoreCase))
        {
            _metrics.IncrementConsumedPaymentEvents();
            try
            {
                var paymentEvent = JsonSerializer.Deserialize<PaymentEvent>(payload, _jsonOptions);
                if (paymentEvent is null || string.IsNullOrWhiteSpace(paymentEvent.EventType))
                {
                    _metrics.IncrementFailedPaymentEvents();
                    _logger.LogWarning("Received invalid payment event payload.");
                    return;
                }

                await _bookingApplicationService.ApplyPaymentEventAsync(paymentEvent, cancellationToken);
            }
            catch (Exception ex)
            {
                _metrics.IncrementFailedPaymentEvents();
                _logger.LogError(ex, "Failed processing payment event payload: {Payload}", payload);
            }
        }
    }

    private async Task EnsureTopicsIfConfiguredAsync(CancellationToken cancellationToken)
    {
        if (!_options.EnsureTopics)
        {
            return;
        }

        var topics = new[]
        {
            _options.BookingEventsTopic,
            _options.InventoryEventsTopic,
            _options.PaymentEventsTopic
        };

        var topicSpecs = topics
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => new TopicSpecification
            {
                Name = x.Trim(),
                NumPartitions = Math.Max(1, _options.TopicPartitions),
                ReplicationFactor = _options.TopicReplicationFactor < 1 ? (short)1 : _options.TopicReplicationFactor
            })
            .ToList();

        if (topicSpecs.Count == 0)
        {
            return;
        }

        using var admin = new AdminClientBuilder(new AdminClientConfig
        {
            BootstrapServers = _options.BootstrapServers
        }).Build();

        try
        {
            await admin.CreateTopicsAsync(topicSpecs);
            _logger.LogInformation("Ensured Kafka topics for booking-service: {Topics}", string.Join(", ", topicSpecs.Select(x => x.Name)));
        }
        catch (CreateTopicsException ex)
        {
            var allAlreadyExists = ex.Results.All(r => r.Error.Code == ErrorCode.TopicAlreadyExists);
            if (allAlreadyExists)
            {
                _logger.LogInformation("Kafka topics already exist for booking-service.");
                return;
            }

            _logger.LogWarning(ex, "Failed creating Kafka topics for booking-service. Service will continue and retry consuming.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Topic ensure step failed for booking-service. Service will continue and retry consuming.");
        }
    }

    private static bool IsMissingTopicError(ConsumeException ex)
        => ex.Error.Code == ErrorCode.UnknownTopicOrPart || ex.Error.Code == ErrorCode.Local_UnknownTopic;

    private void MaybeLogMissingTopic(ConsumeException ex)
    {
        var now = DateTimeOffset.UtcNow;
        if (now - _lastMissingTopicLogAt < TimeSpan.FromSeconds(30))
        {
            return;
        }

        _lastMissingTopicLogAt = now;
        _logger.LogWarning(
            "Kafka topic is not available yet for booking-service: {Reason}. Retrying...",
            ex.Error.Reason);
    }
}
