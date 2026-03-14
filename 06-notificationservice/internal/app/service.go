package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"notificationservice/internal/domain"
)

const schemaVersion = "v1"

type Service struct {
	publisher        Publisher
	audit            AuditStore
	deduper          Deduper
	throttler        Throttler
	retryQueue       RetryQueue
	source           string
	dedupTTL         time.Duration
	throttleMax      int
	throttleWindow   time.Duration
	retryMaxAttempts int
	now              Clock
	newID            IDFunc
}

type ServiceDeps struct {
	Publisher        Publisher
	AuditStore       AuditStore
	Deduper          Deduper
	Throttler        Throttler
	RetryQueue       RetryQueue
	Source           string
	DedupTTL         time.Duration
	ThrottleMax      int
	ThrottleWindow   time.Duration
	RetryMaxAttempts int
	Now              Clock
	NewID            IDFunc
}

func NewService(deps ServiceDeps) (*Service, error) {
	if deps.Publisher == nil {
		return nil, errors.New("publisher is required")
	}
	if deps.Deduper == nil {
		return nil, errors.New("deduper is required")
	}
	if deps.Throttler == nil {
		return nil, errors.New("throttler is required")
	}
	if deps.RetryQueue == nil {
		return nil, errors.New("retry queue is required")
	}

	auditStore := deps.AuditStore
	if auditStore == nil {
		auditStore = NoopAuditStore{}
	}

	now := deps.Now
	if now == nil {
		now = time.Now
	}

	newID := deps.NewID
	if newID == nil {
		newID = defaultID
	}

	return &Service{
		publisher:        deps.Publisher,
		audit:            auditStore,
		deduper:          deps.Deduper,
		throttler:        deps.Throttler,
		retryQueue:       deps.RetryQueue,
		source:           deps.Source,
		dedupTTL:         deps.DedupTTL,
		throttleMax:      deps.ThrottleMax,
		throttleWindow:   deps.ThrottleWindow,
		retryMaxAttempts: deps.RetryMaxAttempts,
		now:              now,
		newID:            newID,
	}, nil
}

func (s *Service) SendOtp(ctx context.Context, req OtpRequest, correlationID string) (OtpResult, error) {
	dedupKey := fmt.Sprintf("dedup:otp:%s:%s", req.UserID, req.Code)
	if isNew, err := s.deduper.IsNew(ctx, dedupKey, s.dedupTTL); err == nil && !isNew {
		return OtpResult{Deduped: true}, nil
	}

	if allowed, err := s.throttler.Allow(ctx, req.UserID, req.Channel, s.throttleMax, s.throttleWindow); err == nil && !allowed {
		return OtpResult{}, ErrThrottled
	}

	notificationID := s.newID("NTF")
	event := domain.NotificationEvent{
		EventID:        s.newID("EVT"),
		EventType:      "NOTIFICATION_ACCEPTED",
		OccurredAt:     s.now().UTC().Format(time.RFC3339),
		Source:         s.source,
		SchemaVersion:  schemaVersion,
		CorrelationID:  correlationID,
		UserID:         req.UserID,
		ActorType:      req.ActorType,
		NotificationID: notificationID,
		Channel:        req.Channel,
		Payload: map[string]any{
			"type":        "otp",
			"destination": req.Destination,
			"code":        req.Code,
			"ttlSeconds":  req.TtlSeconds,
		},
	}

	if err := s.publisher.Publish(ctx, event); err != nil {
		_ = s.retryQueue.Enqueue(ctx, event, 0)
		return OtpResult{}, ErrPublishFailed
	}

	_ = s.audit.Insert(ctx, event, "accepted")
	return OtpResult{NotificationID: notificationID}, nil
}

func (s *Service) HandleTopicEvent(ctx context.Context, topic string, payload map[string]any) error {
	eventID := readString(payload, "eventId")
	if eventID == "" {
		eventID = s.newID("EVT")
	}

	userID := readString(payload, "userId")
	if userID == "" {
		return nil
	}

	dedupKey := fmt.Sprintf("dedup:%s:%s", topic, eventID)
	if isNew, err := s.deduper.IsNew(ctx, dedupKey, s.dedupTTL); err == nil && !isNew {
		return nil
	}

	channel := "email"
	if allowed, err := s.throttler.Allow(ctx, userID, channel, s.throttleMax, s.throttleWindow); err == nil && !allowed {
		event := domain.NotificationEvent{
			EventID:        eventID,
			EventType:      "NOTIFICATION_THROTTLED",
			OccurredAt:     s.now().UTC().Format(time.RFC3339),
			Source:         s.source,
			SchemaVersion:  schemaVersion,
			UserID:         userID,
			NotificationID: s.newID("NTF"),
			Channel:        channel,
			Payload:        payload,
		}
		_ = s.audit.Insert(ctx, event, "throttled")
		return nil
	}

	notificationID := s.newID("NTF")
	event := domain.NotificationEvent{
		EventID:        eventID,
		EventType:      "NOTIFICATION_ACCEPTED",
		OccurredAt:     s.now().UTC().Format(time.RFC3339),
		Source:         s.source,
		SchemaVersion:  schemaVersion,
		CorrelationID:  readString(payload, "correlationId"),
		UserID:         userID,
		ActorType:      readString(payload, "actorType"),
		NotificationID: notificationID,
		Channel:        channel,
		Payload:        payload,
	}

	if err := s.publisher.Publish(ctx, event); err != nil {
		_ = s.retryQueue.Enqueue(ctx, event, 0)
		return ErrPublishFailed
	}

	_ = s.audit.Insert(ctx, event, "accepted")
	return nil
}

func (s *Service) RunRetryWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		item, ok, err := s.retryQueue.Dequeue(ctx, 5*time.Second)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return
			}
			time.Sleep(1 * time.Second)
			continue
		}
		if !ok {
			continue
		}

		if item.Attempt >= s.retryMaxAttempts {
			_ = s.audit.Insert(ctx, item.Event, "failed")
			continue
		}

		backoff := time.Duration(1<<item.Attempt) * time.Second
		timer := time.NewTimer(backoff)
		select {
		case <-timer.C:
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return
		}

		if err := s.publisher.Publish(ctx, item.Event); err != nil {
			_ = s.retryQueue.Enqueue(ctx, item.Event, item.Attempt+1)
			continue
		}

		_ = s.audit.Insert(ctx, item.Event, "accepted")
	}
}

func defaultID(prefix string) string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(buf))
}

func readString(payload map[string]any, key string) string {
	if value, ok := payload[key]; ok && value != nil {
		return fmt.Sprintf("%v", value)
	}
	return ""
}
