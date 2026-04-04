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
	"notificationservice/internal/observability"
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
	postgresAvailable := false
	if cfg.PostgresEnabled {
		pool, err := pgxpool.New(ctx, cfg.PostgresDSN)
		if err != nil {
			logger.Printf("postgres unavailable, continuing without audit store: %v", err)
		} else {
			if err := postgresinfra.EnsureAuditTable(ctx, pool); err != nil {
				logger.Printf("postgres unavailable, continuing without audit store: %v", err)
				pool.Close()
			} else {
				pgPool = pool
				postgresAvailable = true
				auditStore = postgresinfra.NewAuditStore(pgPool)
			}
		}
	}
	if pgPool != nil {
		defer pgPool.Close()
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

	shutdownOtel, otelEnabled, err := observability.Setup(ctx, observability.FromEnv("notification-service"))
	if err != nil {
		logger.Printf("otel setup failed: %v", err)
	}
	if shutdownOtel != nil {
		defer func() {
			_ = shutdownOtel(context.Background())
		}()
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
			PostgresEnabled: postgresAvailable,
			KafkaEnabled:    cfg.KafkaEnabled,
		},
	})
	if otelEnabled {
		handler = observability.WrapHandler(handler, "notification-service")
	}

	addr := fmt.Sprintf(":%d", cfg.HttpPort)
	if cfg.HttpHost != "" {
		addr = fmt.Sprintf("%s:%d", cfg.HttpHost, cfg.HttpPort)
	}

	server := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	go func() {
		scheme := "http"
		if cfg.HttpsEnabled {
			scheme = "https"
		}
		logger.Printf("notification-service %s listening on %s", scheme, addr)

		var err error
		if cfg.HttpsEnabled {
			err = server.ListenAndServeTLS(cfg.TlsCertFile, cfg.TlsKeyFile)
		} else {
			err = server.ListenAndServe()
		}

		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatalf("http server error: %v", err)
		}
	}()

	<-ctx.Done()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = server.Shutdown(shutdownCtx)
	wg.Wait()
}
