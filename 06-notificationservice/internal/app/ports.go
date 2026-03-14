package app

import (
	"context"
	"errors"
	"time"

	"notificationservice/internal/domain"
)

var (
	ErrThrottled     = errors.New("throttled")
	ErrPublishFailed = errors.New("publish failed")
)

type Publisher interface {
	Publish(ctx context.Context, event domain.NotificationEvent) error
}

type AuditStore interface {
	Insert(ctx context.Context, event domain.NotificationEvent, status string) error
}

type Deduper interface {
	IsNew(ctx context.Context, key string, ttl time.Duration) (bool, error)
}

type Throttler interface {
	Allow(ctx context.Context, userID, channel string, max int, window time.Duration) (bool, error)
}

type RetryQueue interface {
	Enqueue(ctx context.Context, event domain.NotificationEvent, attempt int) error
	Dequeue(ctx context.Context, timeout time.Duration) (RetryItem, bool, error)
}

type RetryItem struct {
	Attempt int
	Event   domain.NotificationEvent
}

type Clock func() time.Time

type IDFunc func(prefix string) string

type NoopAuditStore struct{}

func (NoopAuditStore) Insert(ctx context.Context, event domain.NotificationEvent, status string) error {
	return nil
}

type OtpRequest struct {
	UserID      string
	ActorType   string
	Destination string
	Channel     string
	Code        string
	TtlSeconds  int
}

type OtpResult struct {
	NotificationID string
	Deduped        bool
}
