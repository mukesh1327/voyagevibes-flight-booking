package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"notificationservice/internal/app"
	"notificationservice/internal/config"
	kafkainfra "notificationservice/internal/infra/kafka"
	postgresinfra "notificationservice/internal/infra/postgres"
	redisinfra "notificationservice/internal/infra/redis"
	transporthttp "notificationservice/internal/transport/http"
	transportkafka "notificationservice/internal/transport/kafka"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger := log.New(os.Stdout, "", log.LstdFlags)

	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	defer redisClient.Close()

	var auditStore app.AuditStore = app.NoopAuditStore{}
	var pgPool *pgxpool.Pool
	if cfg.PostgresEnabled {
		pool, err := pgxpool.New(ctx, cfg.PostgresDSN)
		if err != nil {
			logger.Fatalf("failed to create postgres pool: %v", err)
		}
		pgPool = pool
		defer pgPool.Close()

		if err := postgresinfra.EnsureAuditTable(ctx, pgPool); err != nil {
			logger.Fatalf("failed to ensure audit table: %v", err)
		}
		auditStore = postgresinfra.NewAuditStore(pgPool)
	}

	publisher := kafkainfra.NewPublisher(cfg.KafkaBrokers, cfg.NotificationTopic)
	defer publisher.Close()

	deduper := redisinfra.NewDeduper(redisClient)
	throttler := redisinfra.NewThrottler(redisClient)
	retryQueue := redisinfra.NewRetryQueue(redisClient, "notification:retry")

	service, err := app.NewService(app.ServiceDeps{
		Publisher:        publisher,
		AuditStore:       auditStore,
		Deduper:          deduper,
		Throttler:        throttler,
		RetryQueue:       retryQueue,
		Source:           cfg.Source,
		DedupTTL:         cfg.DedupTTL,
		ThrottleMax:      cfg.ThrottleMax,
		ThrottleWindow:   cfg.ThrottleWindow,
		RetryMaxAttempts: cfg.RetryMaxAttempts,
	})
	if err != nil {
		logger.Fatalf("failed to wire service: %v", err)
	}

	var wg sync.WaitGroup
	if cfg.KafkaEnabled {
		topics := []string{cfg.BookingTopic, cfg.PaymentTopic, cfg.InventoryTopic}
		for _, topic := range topics {
			consumer := transportkafka.NewConsumer(cfg.KafkaBrokers, cfg.KafkaGroupID, topic, logger)
			consumer.Run(ctx, &wg, service.HandleTopicEvent)
		}
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		service.RunRetryWorker(ctx)
	}()

	handler := transporthttp.NewHandler(transporthttp.HandlerDeps{
		Service: service,
		Health: transporthttp.HealthInfo{
			Service:         "notification-service",
			RedisConfigured: cfg.RedisAddr != "",
			PostgresEnabled: cfg.PostgresEnabled,
			KafkaEnabled:    cfg.KafkaEnabled,
		},
	})

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.HttpPort),
		Handler: handler,
	}

	go func() {
		logger.Printf("notification-service http listening on :%d", cfg.HttpPort)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatalf("http server error: %v", err)
		}
	}()

	<-ctx.Done()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = server.Shutdown(shutdownCtx)
	wg.Wait()
}
