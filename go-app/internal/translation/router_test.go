package translation_test

import (
	"testing"

	. "talk/go-app/internal/translation"
	"talk/go-app/internal/translation/adapters"
)

func TestRouterFallsBackToMockWhenGroqIsUnhealthy(t *testing.T) {
	router := NewTranslationRouter([]TranslationLLM{
		&adapters.GroqTranslationAdapter{APIKey: "test-key"},
		&adapters.MockTranslationAdapter{},
	}, "groq")
	router.SetHealth("groq", false, "rate-limited")
	adapter := router.Pick(TranslationRequest{RequestID: "req-1", SourceLang: "ko", TargetLang: "en", Text: "hello"})
	if adapter.Provider() != "mock" {
		t.Fatalf("expected mock, got %s", adapter.Provider())
	}
}
