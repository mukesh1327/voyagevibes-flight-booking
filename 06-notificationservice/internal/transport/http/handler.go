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

	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "UP",
			"details": map[string]any{
				"service":  deps.Health.Service,
				"redis":    redisStatus,
				"postgres": deps.Health.PostgresEnabled,
				"kafka":    deps.Health.KafkaEnabled,
			},
		})
	})

	mux.HandleFunc("/api/v1/health/live", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "UP"})
	})

	mux.HandleFunc("/api/v1/health/ready", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "UP"})
	})

	mux.HandleFunc("/api/v1/otp/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var payload struct {
			UserID      string `json:"userId"`
			ActorType   string `json:"actorType"`
			Destination string `json:"destination"`
			Channel     string `json:"channel"`
			Code        string `json:"code"`
			TtlSeconds  int    `json:"ttlSeconds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"code": "BAD_REQUEST", "message": "invalid json"})
			return
		}
		if payload.UserID == "" || payload.Code == "" || payload.Destination == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"code": "BAD_REQUEST", "message": "userId, destination, code are required"})
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
				writeJSON(w, http.StatusOK, map[string]any{"accepted": true, "deduped": true})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"accepted": true, "notificationId": result.NotificationID})
			return
		}

		if errors.Is(err, app.ErrThrottled) {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{"code": "THROTTLED", "message": "too many requests"})
			return
		}

		if errors.Is(err, app.ErrPublishFailed) {
			writeJSON(w, http.StatusBadGateway, map[string]any{"code": "KAFKA_ERROR", "message": "failed to publish notification"})
			return
		}

		writeJSON(w, http.StatusInternalServerError, map[string]any{"code": "INTERNAL_ERROR", "message": "internal server error"})
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, payload map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
