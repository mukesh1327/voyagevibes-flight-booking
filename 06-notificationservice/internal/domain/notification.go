package domain

type NotificationEvent struct {
	EventID        string         `json:"eventId"`
	EventType      string         `json:"eventType"`
	OccurredAt     string         `json:"occurredAt"`
	Source         string         `json:"source"`
	SchemaVersion  string         `json:"schemaVersion"`
	CorrelationID  string         `json:"correlationId,omitempty"`
	UserID         string         `json:"userId,omitempty"`
	ActorType      string         `json:"actorType,omitempty"`
	NotificationID string         `json:"notificationId"`
	Channel        string         `json:"channel"`
	Payload        map[string]any `json:"payload"`
}
