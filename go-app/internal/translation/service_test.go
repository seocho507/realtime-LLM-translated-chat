package translation_test

import (
	"testing"

	"talk/go-app/internal/config"
	"talk/go-app/internal/observability"
	. "talk/go-app/internal/translation"
	"talk/go-app/internal/translation/adapters"
)

func TestTranslationServiceServesCachedResultOnSecondRequest(t *testing.T) {
	cache := NewMemoryTranslationCache()
	metrics := observability.NewMetricsRegistry()
	service := NewTranslationService(config.Config{TranslationCacheTTLSeconds: 86400}, NewTranslationRouter([]TranslationLLM{&adapters.MockTranslationAdapter{}}, "mock"), cache, metrics)
	request := TranslationRequest{RequestID: "req-1", SourceLang: "ko", TargetLang: "en", Text: "안녕하세요"}
	firstEvents, err := service.Translate(request)
	if err != nil {
		t.Fatalf("translate first: %v", err)
	}
	secondEvents, err := service.Translate(request)
	if err != nil {
		t.Fatalf("translate second: %v", err)
	}
	firstFinal := firstEvents[len(firstEvents)-1].(StreamFinal)
	secondFinal := secondEvents[len(secondEvents)-1].(StreamFinal)
	if firstFinal.Cached {
		t.Fatal("first final should not be cached")
	}
	if !secondFinal.Cached {
		t.Fatal("second final should be cached")
	}
	if metrics.Counters["cache_hit_rate"] != 1 {
		t.Fatalf("expected cache_hit_rate=1, got %d", metrics.Counters["cache_hit_rate"])
	}
}

func TestTranslationServiceReplaysProviderMetadataOnCacheHit(t *testing.T) {
	cache := NewMemoryTranslationCache()
	service := NewTranslationService(config.Config{TranslationCacheTTLSeconds: 86400}, NewTranslationRouter([]TranslationLLM{&adapters.MockTranslationAdapter{}}, "mock"), cache, nil)
	request := TranslationRequest{RequestID: "req-cache", SourceLang: "ko", TargetLang: "en", Text: "안녕하세요"}
	firstPass, err := service.Translate(request)
	if err != nil {
		t.Fatalf("first pass: %v", err)
	}
	secondPass, err := service.Translate(request)
	if err != nil {
		t.Fatalf("second pass: %v", err)
	}
	if firstPass[len(firstPass)-1].(StreamFinal).Cached {
		t.Fatal("first pass should not be cached")
	}
	start, ok := secondPass[0].(StreamStart)
	if !ok || start.Provider != "mock" {
		t.Fatalf("unexpected second start: %#v", secondPass[0])
	}
	if !secondPass[len(secondPass)-1].(StreamFinal).Cached {
		t.Fatal("expected cached second final")
	}
}

func TestCacheKeyContainsRequiredDimensions(t *testing.T) {
	tone := "formal"
	service := NewTranslationService(config.Config{}, NewTranslationRouter([]TranslationLLM{&adapters.MockTranslationAdapter{}}, "mock"), nil, nil)
	key := service.BuildCacheKey(TranslationRequest{RequestID: "req-1", SourceLang: "ko", TargetLang: "en", Text: "안녕하세요", Tone: &tone, Metadata: map[string]string{"prompt_version": "v2"}}, "mock", "mock-sonnet")
	prefix := "tr:v2:mock:mock-sonnet:ko:en:formal:v2:"
	if len(key) <= len(prefix) || key[:len(prefix)] != prefix {
		t.Fatalf("unexpected cache key: %s", key)
	}
}

func TestStreamFinalCachedDefaultsFalse(t *testing.T) {
	event := StreamFinal{Text: "hello", FinishReason: "stop"}
	if event.Cached {
		t.Fatal("cached should default false")
	}
}
