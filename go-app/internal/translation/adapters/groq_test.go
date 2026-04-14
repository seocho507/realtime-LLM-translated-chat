package adapters

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"talk/go-app/internal/translation"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestGroqAdapterStreamsStartDeltaAndFinal(t *testing.T) {
	body := strings.Join([]string{
		"data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"},\"finish_reason\":null}]}",
		"",
		"data: {\"choices\":[{\"delta\":{\"content\":\" world\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":2}}",
		"",
		"data: [DONE]",
		"",
	}, "\n")
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("unexpected auth header: %s", got)
		}
		return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	adapter := &GroqTranslationAdapter{APIKey: "test-key", Client: client}
	events, err := adapter.TranslateStream(translation.TranslationRequest{RequestID: "req-1", SourceLang: "ko", TargetLang: "en", Text: "hello"})
	if err != nil {
		t.Fatalf("translate stream: %v", err)
	}
	if _, ok := events[0].(translation.StreamStart); !ok {
		t.Fatalf("expected start event, got %#v", events[0])
	}
	final, ok := events[len(events)-1].(translation.StreamFinal)
	if !ok {
		t.Fatalf("expected final event, got %#v", events[len(events)-1])
	}
	if final.Text != "Hello world" {
		t.Fatalf("unexpected final text: %s", final.Text)
	}
	if final.InputTokens == nil || *final.InputTokens != 12 || final.OutputTokens == nil || *final.OutputTokens != 2 {
		t.Fatalf("unexpected token counts: %+v", final)
	}
}

func TestGroqAdapterMapsRateLimitErrors(t *testing.T) {
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 429, Body: io.NopCloser(strings.NewReader(`{"error":{"message":"Rate limit exceeded"}}`))}, nil
	})}
	adapter := &GroqTranslationAdapter{APIKey: "test-key", Client: client}
	events, err := adapter.TranslateStream(translation.TranslationRequest{RequestID: "req-1", SourceLang: "ko", TargetLang: "en", Text: "hello"})
	if err != nil {
		t.Fatalf("translate stream: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}
	errEvent, ok := events[0].(translation.StreamError)
	if !ok {
		t.Fatalf("expected stream error, got %#v", events[0])
	}
	if errEvent.Code != translation.RateLimited || !errEvent.Retryable {
		t.Fatalf("unexpected error event: %+v", errEvent)
	}
}
