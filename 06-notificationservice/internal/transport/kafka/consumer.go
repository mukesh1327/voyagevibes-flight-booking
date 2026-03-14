package transportkafka

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

type Consumer struct {
	reader *kafka.Reader
	topic  string
	logger *log.Logger
}

func NewConsumer(brokers []string, groupID, topic string, logger *log.Logger) *Consumer {
	if logger == nil {
		logger = log.Default()
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: brokers,
		GroupID: groupID,
		Topic:   topic,
	})

	return &Consumer{
		reader: reader,
		topic:  topic,
		logger: logger,
	}
}

func (c *Consumer) Run(ctx context.Context, wg *sync.WaitGroup, handler func(context.Context, string, map[string]any) error) {
	if handler == nil {
		panic("handler is required")
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		defer c.reader.Close()

		for {
			msg, err := c.reader.FetchMessage(ctx)
			if err != nil {
				if errors.Is(err, context.Canceled) {
					return
				}
				c.logger.Printf("kafka read error (%s): %v", c.topic, err)
				time.Sleep(1 * time.Second)
				continue
			}

			var payload map[string]any
			if err := json.Unmarshal(msg.Value, &payload); err != nil {
				c.logger.Printf("invalid payload on %s: %v", c.topic, err)
				_ = c.reader.CommitMessages(ctx, msg)
				continue
			}

			if err := handler(ctx, c.topic, payload); err != nil {
				c.logger.Printf("handler error on %s: %v", c.topic, err)
				continue
			}

			_ = c.reader.CommitMessages(ctx, msg)
		}
	}()
}
