package transporthttp

type HealthResponse struct {
	Status  string         `json:"status"`
	Details *HealthDetails `json:"details,omitempty"`
}

type HealthDetails struct {
	Service  string `json:"service"`
	Redis    string `json:"redis"`
	Postgres bool   `json:"postgres"`
	Kafka    bool   `json:"kafka"`
}

type StatusResponse struct {
	Status string `json:"status"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type SendOtpRequest struct {
	UserID      string `json:"userId"`
	ActorType   string `json:"actorType"`
	Destination string `json:"destination"`
	Channel     string `json:"channel"`
	Code        string `json:"code"`
	TtlSeconds  int    `json:"ttlSeconds"`
}

type SendOtpAcceptedResponse struct {
	Accepted       bool   `json:"accepted"`
	NotificationID string `json:"notificationId,omitempty"`
	Deduped        bool   `json:"deduped,omitempty"`
}
