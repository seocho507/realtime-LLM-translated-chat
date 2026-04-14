package adapters

import (
	"testing"

	"talk/go-app/internal/translation"
)

func TestMockAdapterStreamsStartDeltaAndFinal(t *testing.T) {
	adapter := &MockTranslationAdapter{}
	events, err := adapter.TranslateStream(translation.TranslationRequest{RequestID: "req-1", SourceLang: "ko", TargetLang: "en", Text: "안녕하세요"})
	if err != nil {
		t.Fatalf("translate stream: %v", err)
	}
	if _, ok := events[0].(translation.StreamStart); !ok {
		t.Fatalf("expected first event start, got %#v", events[0])
	}
	foundDelta := false
	for _, event := range events {
		if _, ok := event.(translation.StreamDelta); ok {
			foundDelta = true
		}
	}
	if !foundDelta {
		t.Fatal("expected delta event")
	}
	final, ok := events[len(events)-1].(translation.StreamFinal)
	if !ok {
		t.Fatalf("expected final event, got %#v", events[len(events)-1])
	}
	if final.Text[:4] != "[en]" {
		t.Fatalf("unexpected final text: %s", final.Text)
	}
}
