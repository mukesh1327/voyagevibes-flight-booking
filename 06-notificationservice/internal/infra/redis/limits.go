package redisinfra

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Deduper struct {
	client *redis.Client
}

func NewDeduper(client *redis.Client) *Deduper {
	return &Deduper{client: client}
}

func (d *Deduper) IsNew(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	return d.client.SetNX(ctx, key, "1", ttl).Result()
}

type Throttler struct {
	client *redis.Client
}

func NewThrottler(client *redis.Client) *Throttler {
	return &Throttler{client: client}
}

func (t *Throttler) Allow(ctx context.Context, userID, channel string, max int, window time.Duration) (bool, error) {
	if max <= 0 {
		return true, nil
	}

	key := fmt.Sprintf("throttle:%s:%s", userID, channel)
	val, err := t.client.Incr(ctx, key).Result()
	if err != nil {
		return true, err
	}
	if val == 1 {
		_ = t.client.Expire(ctx, key, window).Err()
	}
	return int(val) <= max, nil
}
