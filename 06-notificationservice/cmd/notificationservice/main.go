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
	"notificationservice/internal/observability"
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

	type serverBinding struct {
		scheme   string
		server   *http.Server
		certFile string
		keyFile  string
	}

	httpServer := &http.Server{
		Addr:    formatAddr(cfg.HttpHost, cfg.HttpPort),
		Handler: handler,
	}

	bindings := []serverBinding{
		{
			scheme: "http",
			server: httpServer,
		},
	}

	if cfg.HttpsEnabled {
		bindings = append(bindings, serverBinding{
			scheme:   "https",
			server:   &http.Server{Addr: formatAddr(cfg.HttpHost, cfg.HttpsPort), Handler: handler},
			certFile: cfg.TlsCertFile,
			keyFile:  cfg.TlsKeyFile,
		})
	}

	errCh := make(chan error, len(bindings))
	for _, binding := range bindings {
		go func(binding serverBinding) {
			logger.Printf("notification-service %s listening on %s", binding.scheme, binding.server.Addr)

			var err error
			if binding.scheme == "https" {
				err = binding.server.ListenAndServeTLS(binding.certFile, binding.keyFile)
			} else {
				err = binding.server.ListenAndServe()
			}

			if err != nil && !errors.Is(err, http.ErrServerClosed) {
				errCh <- fmt.Errorf("%s server error: %w", binding.scheme, err)
			}
		}(binding)
	}

	select {
	case <-ctx.Done():
	case err := <-errCh:
		logger.Printf("%v", err)
		stop()
		<-ctx.Done()
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	for _, binding := range bindings {
		if err := binding.server.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Printf("shutdown error for %s server: %v", binding.scheme, err)
		}
	}
	wg.Wait()
}

func formatAddr(host string, port int) string {
	if host != "" {
		return fmt.Sprintf("%s:%d", host, port)
	}
	return fmt.Sprintf(":%d", port)
}
