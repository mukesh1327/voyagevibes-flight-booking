package notification

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type BookingConfirmedRequest struct {
	BookingID string `json:"bookingId" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Name      string `json:"name" binding:"required"`
}

type BookingConfirmedResponse struct {
	BookingID string `json:"bookingId"`
	Status    string `json:"status"`
	Duplicate bool   `json:"duplicate"`
	Channel   string `json:"channel"`
	Recipient string `json:"recipient"`
	QueuedAt   string `json:"queuedAt"`
}

type Service struct {
	redis *redis.Client
	ttl   time.Duration
}

func NewService(redisClient *redis.Client, ttl time.Duration) *Service {
	return &Service{redis: redisClient, ttl: ttl}
}

func (s *Service) SendBookingConfirmed(ctx context.Context, request BookingConfirmedRequest) (BookingConfirmedResponse, error) {
	bookingID := normalizeBookingID(request.BookingID)
	if bookingID == "" {
		return BookingConfirmedResponse{}, fmt.Errorf("booking id is required")
	}

	key := fmt.Sprintf("notification:booking:%s", bookingID)

	created, err := s.redis.SetNX(ctx, key, "SENT", s.ttl).Result()
	if err != nil {
		return BookingConfirmedResponse{}, err
	}

	if !created {
		return BookingConfirmedResponse{
			BookingID: bookingID,
			Status:    "SENT",
			Duplicate: true,
			Channel:   "email",
			Recipient: normalizeEmail(request.Email),
			QueuedAt:   time.Now().UTC().Format(time.RFC3339),
		}, nil
	}

	// Local development intentionally mocks the email provider while keeping idempotent delivery semantics.
	return BookingConfirmedResponse{
		BookingID: bookingID,
		Status:    "SENT",
		Duplicate: false,
		Channel:   "email",
		Recipient: normalizeEmail(request.Email),
		QueuedAt:   time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func normalizeBookingID(value string) string {
	return strings.TrimSpace(value)
}

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
