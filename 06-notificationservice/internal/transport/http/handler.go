package transporthttp

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"notificationservice/internal/app"
)

type HandlerDeps struct {
	Service *app.Service
	Health  HealthInfo
}

type HealthInfo struct {
	Service         string
	RedisConfigured bool
	PostgresEnabled bool
	KafkaEnabled    bool
}

func NewHandler(deps HandlerDeps) http.Handler {
	if deps.Service == nil {
		panic("service is required")
	}

	redisStatus := "not_configured"
	if deps.Health.RedisConfigured {
		redisStatus = "configured"
	}

	mux := http.NewServeMux()
	registerSwaggerRoutes(mux)

	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, HealthResponse{
			Status: "UP",
			Details: &HealthDetails{
				Service:  deps.Health.Service,
				Redis:    redisStatus,
				Postgres: deps.Health.PostgresEnabled,
				Kafka:    deps.Health.KafkaEnabled,
			},
		})
	})

	mux.HandleFunc("/api/v1/health/live", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, StatusResponse{Status: "UP"})
	})

	mux.HandleFunc("/api/v1/health/ready", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, StatusResponse{Status: "UP"})
	})

	mux.HandleFunc("/api/v1/otp/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var payload SendOtpRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Code: "BAD_REQUEST", Message: "invalid json"})
			return
		}
		if payload.UserID == "" || payload.Code == "" || payload.Destination == "" {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Code: "BAD_REQUEST", Message: "userId, destination, code are required"})
			return
		}

		channel := strings.ToLower(strings.TrimSpace(payload.Channel))
		if channel == "" {
			channel = "sms"
		}
		ttl := payload.TtlSeconds
		if ttl <= 0 {
			ttl = 300
		}

		result, err := deps.Service.SendOtp(r.Context(), app.OtpRequest{
			UserID:      payload.UserID,
			ActorType:   payload.ActorType,
			Destination: payload.Destination,
			Channel:     channel,
			Code:        payload.Code,
			TtlSeconds:  ttl,
		}, r.Header.Get("X-Correlation-Id"))
		if err == nil {
			if result.Deduped {
				writeJSON(w, http.StatusOK, SendOtpAcceptedResponse{Accepted: true, Deduped: true})
				return
			}
			writeJSON(w, http.StatusOK, SendOtpAcceptedResponse{Accepted: true, NotificationID: result.NotificationID})
			return
		}

		if errors.Is(err, app.ErrThrottled) {
			writeJSON(w, http.StatusTooManyRequests, ErrorResponse{Code: "THROTTLED", Message: "too many requests"})
			return
		}

		if errors.Is(err, app.ErrPublishFailed) {
			writeJSON(w, http.StatusBadGateway, ErrorResponse{Code: "KAFKA_ERROR", Message: "failed to publish notification"})
			return
		}

		writeJSON(w, http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "internal server error"})
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
