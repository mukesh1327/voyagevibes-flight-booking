package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HttpHost          string
	HttpPort          int
	HttpsEnabled      bool
	TlsCertFile       string
	TlsKeyFile        string
	KafkaEnabled      bool
	KafkaBrokers      []string
	KafkaGroupID      string
	BookingTopic      string
	PaymentTopic      string
	InventoryTopic    string
	NotificationTopic string
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	DedupTTL          time.Duration
	ThrottleMax       int
	ThrottleWindow    time.Duration
	RetryMaxAttempts  int
	PostgresEnabled   bool
	PostgresDSN       string
	Source            string
}

func Load() Config {
	return Config{
		HttpHost:          getString("HTTP_HOST", ""),
		HttpPort:          getInt("HTTP_PORT", 8087),
		HttpsEnabled:      getBool("HTTPS_ENABLED", true),
		TlsCertFile:       getString("TLS_CERT_FILE", "https-certs/notification.voyagevibes.in.crt.pem"),
		TlsKeyFile:        getString("TLS_KEY_FILE", "https-certs/notification.voyagevibes.in.key.pem"),
		KafkaEnabled:      getBool("KAFKA_ENABLED", true),
		KafkaBrokers:      getList("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
		KafkaGroupID:      getString("KAFKA_CONSUMER_GROUP_ID", "notification-service"),
		BookingTopic:      getString("KAFKA_BOOKING_EVENTS_TOPIC", "booking.events"),
		PaymentTopic:      getString("KAFKA_PAYMENT_EVENTS_TOPIC", "payment.events"),
		InventoryTopic:    getString("KAFKA_INVENTORY_EVENTS_TOPIC", "flight.inventory.events"),
		NotificationTopic: getString("KAFKA_NOTIFICATION_EVENTS_TOPIC", "notification.events"),
		RedisAddr:         getString("REDIS_ADDR", "localhost:6379"),
		RedisPassword:     getString("REDIS_PASSWORD", ""),
		RedisDB:           getInt("REDIS_DB", 0),
		DedupTTL:          time.Duration(getInt("DEDUP_TTL_SECONDS", 3600)) * time.Second,
		ThrottleMax:       getInt("THROTTLE_MAX", 20),
		ThrottleWindow:    time.Duration(getInt("THROTTLE_WINDOW_SECONDS", 60)) * time.Second,
		RetryMaxAttempts:  getInt("RETRY_MAX_ATTEMPTS", 5),
		PostgresEnabled:   getBool("POSTGRES_ENABLED", true),
		PostgresDSN:       getString("POSTGRES_DSN", "postgresql://notification_app_user:NotificationApp%40123%24@localhost:5432/notification_service_db"),
		Source:            getString("EVENT_SOURCE", "notification-service"),
	}
}

func getString(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}

func getInt(key string, fallback int) int {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return parsed
}

func getBool(key string, fallback bool) bool {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return strings.EqualFold(val, "true")
}

func getList(key, fallback string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		raw = fallback
	}
	parts := strings.Split(raw, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}