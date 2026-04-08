package transporthttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"notificationservice/internal/app"
	"notificationservice/internal/domain"
)

func TestNewHandlerServesSwaggerUI(t *testing.T) {
	handler := NewHandler(testHandlerDeps(t))

	req := httptest.NewRequest(http.MethodGet, "/swagger/", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	if contentType := res.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Fatalf("expected html content type, got %q", contentType)
	}
	if !strings.Contains(res.Body.String(), "SwaggerUIBundle") {
		t.Fatalf("expected Swagger UI bundle bootstrap in HTML")
	}
}

func TestNewHandlerServesOpenAPISpecForAllRoutes(t *testing.T) {
	handler := NewHandler(testHandlerDeps(t))

	req := httptest.NewRequest(http.MethodGet, "/swagger/openapi.json", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var spec struct {
		Paths map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.NewDecoder(res.Body).Decode(&spec); err != nil {
		t.Fatalf("decode spec: %v", err)
	}

	expected := map[string]string{
		"/api/v1/health":       "get",
		"/api/v1/health/live":  "get",
		"/api/v1/health/ready": "get",
		"/api/v1/otp/send":     "post",
	}
	for path, method := range expected {
		ops, ok := spec.Paths[path]
		if !ok {
			t.Fatalf("expected path %s in spec", path)
		}
		if _, ok := ops[method]; !ok {
			t.Fatalf("expected %s operation for path %s", method, path)
		}
	}
}

func TestNewHandlerSendOtpStillWorks(t *testing.T) {
	handler := NewHandler(testHandlerDeps(t))

	body := `{"userId":"USR-1001","actorType":"traveler","destination":"+919999999999","channel":"sms","code":"482193","ttlSeconds":300}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/otp/send", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Correlation-Id", "corr-1001")

	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload SendOtpAcceptedResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Accepted {
		t.Fatalf("expected accepted=true")
	}
	if payload.NotificationID == "" {
		t.Fatalf("expected notificationId in response")
	}
}

func testHandlerDeps(t *testing.T) HandlerDeps {
	t.Helper()

	service, err := app.NewService(app.ServiceDeps{
		Publisher:        testPublisher{},
		AuditStore:       app.NoopAuditStore{},
		Deduper:          testDeduper{},
		Throttler:        testThrottler{},
		RetryQueue:       testRetryQueue{},
		Source:           "notification-service",
		DedupTTL:         time.Minute,
		ThrottleMax:      3,
		ThrottleWindow:   time.Minute,
		RetryMaxAttempts: 3,
		NewID: func(prefix string) string {
			return prefix + "-test-id"
		},
	})
	if err != nil {
		t.Fatalf("create service: %v", err)
	}

	return HandlerDeps{
		Service: service,
		Health: HealthInfo{
			Service:         "notification-service",
			RedisConfigured: true,
			PostgresEnabled: true,
			KafkaEnabled:    true,
		},
	}
}

type testPublisher struct{}

func (testPublisher) Publish(ctx context.Context, event domain.NotificationEvent) error {
	return nil
}

type testDeduper struct{}

func (testDeduper) IsNew(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	return true, nil
}

type testThrottler struct{}

func (testThrottler) Allow(ctx context.Context, userID, channel string, max int, window time.Duration) (bool, error) {
	return true, nil
}

type testRetryQueue struct{}

func (testRetryQueue) Enqueue(ctx context.Context, event domain.NotificationEvent, attempt int) error {
	return nil
}

func (testRetryQueue) Dequeue(ctx context.Context, timeout time.Duration) (app.RetryItem, bool, error) {
	return app.RetryItem{}, false, nil
}
