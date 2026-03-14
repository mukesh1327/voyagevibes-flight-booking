package kafkainfra

import (
	"context"
	"encoding/json"

	"github.com/segmentio/kafka-go"

	"notificationservice/internal/domain"
)

type Publisher struct {
	writer *kafka.Writer
}

func NewPublisher(brokers []string, topic string) *Publisher {
	writer := kafka.NewWriter(kafka.WriterConfig{
		Brokers:  brokers,
		Topic:    topic,
		Balancer: &kafka.Hash{},
	})

	return &Publisher{writer: writer}
}

func (p *Publisher) Publish(ctx context.Context, event domain.NotificationEvent) error {
	value, err := json.Marshal(event)
	if err != nil {
		return err
	}

	key := event.UserID
	if key == "" {
		key = event.NotificationID
	}

	return p.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(key),
		Value: value,
	})
}

func (p *Publisher) Close() error {
	return p.writer.Close()
}
