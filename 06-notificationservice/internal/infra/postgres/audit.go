package postgresinfra

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"notificationservice/internal/domain"
)

type AuditStore struct {
	pool *pgxpool.Pool
}

func NewAuditStore(pool *pgxpool.Pool) *AuditStore {
	return &AuditStore{pool: pool}
}

func (s *AuditStore) Insert(ctx context.Context, event domain.NotificationEvent, status string) error {
	if s.pool == nil {
		return nil
	}

	_, err := s.pool.Exec(ctx, `
        INSERT INTO notification_audit (
            event_id,
            notification_id,
            user_id,
            actor_type,
            channel,
            status,
            payload,
            created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, event.EventID, event.NotificationID, event.UserID, event.ActorType, event.Channel, status, event.Payload)
	return err
}

func EnsureAuditTable(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return nil
	}

	_, err := pool.Exec(ctx, `
        CREATE TABLE IF NOT EXISTS notification_audit (
            id BIGSERIAL PRIMARY KEY,
            event_id TEXT NOT NULL,
            notification_id TEXT NOT NULL,
            user_id TEXT,
            actor_type TEXT,
            channel TEXT NOT NULL,
            status TEXT NOT NULL,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
	return err
}
