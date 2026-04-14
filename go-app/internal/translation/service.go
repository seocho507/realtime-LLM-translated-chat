package translation

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"talk/go-app/internal/config"
	"talk/go-app/internal/observability"
)

type TranslationService struct {
	settings config.Config
	router   *TranslationRouter
	cache    TranslationCache
	metrics  *observability.MetricsRegistry
}

func NewTranslationService(settings config.Config, router *TranslationRouter, cache TranslationCache, metrics *observability.MetricsRegistry) *TranslationService {
	if cache == nil {
		cache = NewMemoryTranslationCache()
	}
	if metrics == nil {
		metrics = observability.NewMetricsRegistry()
	}
	return &TranslationService{settings: settings, router: router, cache: cache, metrics: metrics}
}

func (s *TranslationService) BuildCacheKey(req TranslationRequest, provider, model string) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(strings.ToLower(req.Text))))
	tone := "default"
	if req.Tone != nil && *req.Tone != "" {
		tone = *req.Tone
	}
	promptVersion := "v1"
	if req.Metadata != nil {
		if v := req.Metadata["prompt_version"]; v != "" {
			promptVersion = v
		}
	}
	return fmt.Sprintf("tr:v2:%s:%s:%s:%s:%s:%s:%s", provider, model, req.SourceLang, req.TargetLang, tone, promptVersion, hex.EncodeToString(hash[:]))
}

func (s *TranslationService) Translate(req TranslationRequest) ([]StreamEvent, error) {
	adapter := s.router.Pick(req)
	cacheKey := s.BuildCacheKey(req, adapter.Provider(), adapter.Model())
	if cached := s.cache.Get(cacheKey); cached != nil {
		s.metrics.Increment("cache_hit_rate", 1)
		text := cached["text"].(string)
		provider := cached["provider"].(string)
		model := cached["model"].(string)
		zero := 0
		return []StreamEvent{StreamStart{Provider: provider, Model: model}, StreamFinal{Text: text, FinishReason: "stop", Cached: true, LatencyFirstTokenMS: &zero, LatencyTotalMS: &zero}}, nil
	}
	events, err := adapter.TranslateStream(req)
	if err != nil {
		return nil, err
	}
	var final *StreamFinal
	for _, event := range events {
		if v, ok := event.(StreamFinal); ok {
			vv := v
			final = &vv
		}
	}
	if final != nil {
		s.metrics.Increment("cache_write_total", 1)
		s.cache.Set(cacheKey, map[string]any{"text": final.Text, "provider": adapter.Provider(), "model": adapter.Model()}, s.settings.TranslationCacheTTLSeconds)
	}
	return events, nil
}
