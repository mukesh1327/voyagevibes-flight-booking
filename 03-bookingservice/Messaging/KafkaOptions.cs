namespace bookingservice.Messaging;

public class KafkaOptions
{
    public bool Enabled { get; set; } = true;
    public string BootstrapServers { get; set; } = "localhost:9092";
    public string BookingEventsTopic { get; set; } = "booking.events";
    public string InventoryEventsTopic { get; set; } = "flight.inventory.events";
    public string PaymentEventsTopic { get; set; } = "payment.events";
    public string ConsumerGroupId { get; set; } = "booking-service";
    public string AutoOffsetReset { get; set; } = "latest";
    public bool EnsureTopics { get; set; } = true;
    public int TopicPartitions { get; set; } = 1;
    public short TopicReplicationFactor { get; set; } = 1;
    public int MissingTopicRetryDelayMs { get; set; } = 2000;
}
