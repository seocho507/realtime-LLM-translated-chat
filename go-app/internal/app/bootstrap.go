package app

import (
	"net/http"

	"talk/go-app/internal/auth"
	"talk/go-app/internal/config"
	httpapi "talk/go-app/internal/http"
	"talk/go-app/internal/observability"
	"talk/go-app/internal/orchestration"
	"talk/go-app/internal/persistence"
	"talk/go-app/internal/realtime"
	"talk/go-app/internal/translation"
	"talk/go-app/internal/translation/adapters"
)

func BuildHandler(cfg config.Config) (http.Handler, error) {
	db, err := persistence.Open(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	if err := db.InitModels(); err != nil {
		return nil, err
	}
	metrics := observability.NewMetricsRegistry()
	sessions := auth.NewSessionService(cfg.SessionSecret, cfg.SessionTTLSeconds)
	passwords := auth.NewPasswordService()
	google := &auth.HTTPGoogleVerifier{ClientID: cfg.GoogleClientID, AllowedDomain: cfg.GoogleAllowedDomain}
	connections := realtime.NewConnectionManager()
	router := translation.NewTranslationRouter([]translation.TranslationLLM{
		&adapters.GroqTranslationAdapter{APIKey: cfg.GroqAPIKey, ModelName: cfg.DefaultModel, BaseURL: cfg.GroqAPIBaseURL},
		&adapters.MockTranslationAdapter{},
	}, cfg.DefaultProvider)
	service := translation.NewTranslationService(cfg, router, translation.NewMemoryTranslationCache(), metrics)
	messages := persistence.NewMessageRepository(db.SQL)
	users := persistence.NewUserRepository(db.SQL)
	orchestrator := orchestration.NewMessageOrchestrator(connections, service, messages, metrics)
	server := httpapi.NewServer(cfg, metrics, sessions, passwords, google, users, messages, connections, orchestrator)
	return server.Handler(), nil
}
