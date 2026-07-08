package notification

import "testing"

func TestNormalizeBookingIDTrimsWhitespace(t *testing.T) {
	got := normalizeBookingID(" booking-1 ")
	if got != "booking-1" {
		t.Fatalf("expected trimmed booking id, got %q", got)
	}
}

func TestNormalizeBookingIDReturnsEmptyForBlankInput(t *testing.T) {
	got := normalizeBookingID("   ")
	if got != "" {
		t.Fatalf("expected blank booking id to normalize to empty, got %q", got)
	}
}

func TestNormalizeEmailTrimsAndLowercases(t *testing.T) {
	got := normalizeEmail(" SMOKE@Example.COM ")
	if got != "smoke@example.com" {
		t.Fatalf("expected normalized email, got %q", got)
	}
}
