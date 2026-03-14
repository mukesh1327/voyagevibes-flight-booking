package redisinfra

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"

	"notificationservice/internal/app"
	"notificationservice/internal/domain"
)

type RetryQueue struct {
	client *redis.Client
	key    string
}

func NewRetryQueue(client *redis.Client, key string) *RetryQueue {
	return &RetryQueue{client: client, key: key}
}

func (q *RetryQueue) Enqueue(ctx context.Context, event domain.NotificationEvent, attempt int) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	item := map[string]any{
		"attempt": attempt,
		"event":   json.RawMessage(payload),
	}
	wire, err := json.Marshal(item)
	if err != nil {
		return err
	}
	return q.client.LPush(ctx, q.key, wire).Err()
}

func (q *RetryQueue) Dequeue(ctx context.Context, timeout time.Duration) (app.RetryItem, bool, error) {
	item, err := q.client.BRPop(ctx, timeout, q.key).Result()
	if err != nil {
		if err == redis.Nil {
			return app.RetryItem{}, false, nil
		}
		return app.RetryItem{}, false, err
	}
	if len(item) < 2 {
		return app.RetryItem{}, false, nil
	}

	var envelope struct {
		Attempt int             `json:"attempt"`
		Event   json.RawMessage `json:"event"`
	}
	if err := json.Unmarshal([]byte(item[1]), &envelope); err != nil {
		return app.RetryItem{}, false, nil
	}

	var event domain.NotificationEvent
	if err := json.Unmarshal(envelope.Event, &event); err != nil {
		return app.RetryItem{}, false, nil
	}

	return app.RetryItem{Attempt: envelope.Attempt, Event: event}, true, nil
}
