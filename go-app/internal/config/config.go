package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	AppName                    string
	DatabaseURL                string
	DefaultProvider            string
	DefaultModel               string
	GroqAPIKey                 string
	GroqAPIBaseURL             string
	SessionSecret              string
	SessionTTLSeconds          int
	SessionCookieName          string
	SessionCookieSecure        bool
	SessionCookieSameSite      string
	GoogleClientID             string
	GoogleAllowedDomain        string
	TranslationCacheTTLSeconds int
	WebDistDir                 string
	CORSAllowedOrigins         []string
}

func LoadConfig() Config {
	wd, _ := os.Getwd()
	defaultDist := filepath.Clean(filepath.Join(wd, "..", "web", "dist"))
	return Config{
		AppName:                    getenv("APP_NAME", "Talk Backend"),
		DatabaseURL:                getenv("DATABASE_URL", "./talk.db"),
		DefaultProvider:            getenv("DEFAULT_PROVIDER", "groq"),
		DefaultModel:               getenv("DEFAULT_MODEL", "openai/gpt-oss-20b"),
		GroqAPIKey:                 os.Getenv("GROQ_API_KEY"),
		GroqAPIBaseURL:             getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1/chat/completions"),
		SessionSecret:              getenv("SESSION_SECRET", "dev-session-secret-change-me"),
		SessionTTLSeconds:          getenvInt("SESSION_TTL_SECONDS", 28800),
		SessionCookieName:          getenv("SESSION_COOKIE_NAME", "talk_session"),
		SessionCookieSecure:        getenvBool("SESSION_COOKIE_SECURE", false),
		SessionCookieSameSite:      getenv("SESSION_COOKIE_SAMESITE", "lax"),
		GoogleClientID:             os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleAllowedDomain:        os.Getenv("GOOGLE_ALLOWED_DOMAIN"),
		TranslationCacheTTLSeconds: getenvInt("TRANSLATION_CACHE_TTL_SECONDS", 86400),
		WebDistDir:                 getenv("WEB_DIST_DIR", defaultDist),
		CORSAllowedOrigins:         splitCSV(getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:8000,http://127.0.0.1:8000")),
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getenvBool(key string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	switch value {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
