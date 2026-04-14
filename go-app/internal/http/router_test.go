package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gorilla/websocket"

	"talk/go-app/internal/auth"
	"talk/go-app/internal/config"
	"talk/go-app/internal/observability"
	"talk/go-app/internal/orchestration"
	"talk/go-app/internal/persistence"
	"talk/go-app/internal/realtime"
	"talk/go-app/internal/translation"
	"talk/go-app/internal/translation/adapters"
)

type fakeGoogleVerifier struct{}

func (fakeGoogleVerifier) VerifyToken(credential string) (auth.GoogleIdentity, error) {
	if credential != "good-token" {
		return auth.GoogleIdentity{}, io.EOF
	}
	return auth.GoogleIdentity{Sub: "sub-123", Email: "user@example.com"}, nil
}

func buildTestServer(t *testing.T) (*httptest.Server, config.Config) {
	t.Helper()
	tempDir := t.TempDir()
	cfg := config.Config{
		AppName:                    "Talk Backend",
		DatabaseURL:                filepath.Join(tempDir, "test.db"),
		DefaultProvider:            "mock",
		DefaultModel:               "openai/gpt-oss-20b",
		SessionSecret:              "test-secret",
		SessionTTLSeconds:          28800,
		SessionCookieName:          "talk_session",
		SessionCookieSameSite:      "lax",
		TranslationCacheTTLSeconds: 86400,
		WebDistDir:                 filepath.Join(tempDir, "web-dist"),
	}
	db, err := persistence.Open(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.InitModels(); err != nil {
		t.Fatalf("init models: %v", err)
	}
	metrics := observability.NewMetricsRegistry()
	sessions := auth.NewSessionService(cfg.SessionSecret, cfg.SessionTTLSeconds)
	passwords := auth.NewPasswordService()
	connections := realtime.NewConnectionManager()
	router := translation.NewTranslationRouter([]translation.TranslationLLM{&adapters.MockTranslationAdapter{}}, "mock")
	service := translation.NewTranslationService(cfg, router, translation.NewMemoryTranslationCache(), metrics)
	messages := persistence.NewMessageRepository(db.SQL)
	users := persistence.NewUserRepository(db.SQL)
	orchestrator := orchestration.NewMessageOrchestrator(connections, service, messages, metrics)
	server := NewServer(cfg, metrics, sessions, passwords, fakeGoogleVerifier{}, users, messages, connections, orchestrator)
	return httptest.NewServer(server.Handler()), cfg
}

func TestGoogleLoginIssuesSessionCookie(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	resp, err := http.Post(ts.URL+"/api/auth/google", "application/json", strings.NewReader(`{"credential":"good-token"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	var body map[string]map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["user"]["auth_provider"] != "google" || body["user"]["google_sub"] != "sub-123" {
		t.Fatalf("unexpected body: %+v", body)
	}
	if findCookie(resp.Cookies(), "talk_session") == nil {
		t.Fatal("expected session cookie")
	}
}

func TestGuestLoginIssuesSessionCookie(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	resp, err := http.Post(ts.URL+"/api/auth/guest", "application/json", strings.NewReader(`{"display_name":"Guest User"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body map[string]map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body["user"]["auth_provider"] != "guest" || body["user"]["display_name"] != "Guest User" || body["user"]["google_sub"] != nil {
		t.Fatalf("unexpected body: %+v", body)
	}
	if findCookie(resp.Cookies(), "talk_session") == nil {
		t.Fatal("expected session cookie")
	}
}

func TestLogoutClearsSessionCookie(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	client := &http.Client{}
	loginResp, err := client.Post(ts.URL+"/api/auth/guest", "application/json", strings.NewReader(`{"display_name":"Guest User"}`))
	if err != nil {
		t.Fatal(err)
	}
	cookie := findCookie(loginResp.Cookies(), "talk_session")
	if cookie == nil {
		t.Fatal("missing login cookie")
	}
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/auth/logout", nil)
	req.AddCookie(cookie)
	logoutResp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if logoutResp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d", logoutResp.StatusCode)
	}
	cleared := findCookie(logoutResp.Cookies(), "talk_session")
	if cleared == nil || cleared.MaxAge != -1 {
		t.Fatalf("expected cleared cookie, got %+v", cleared)
	}
}

func TestLocalSignupLoginDuplicateAndSession(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	signupResp, err := http.Post(ts.URL+"/api/auth/signup", "application/json", strings.NewReader(`{"display_name":"Local User","email":"local@example.com","password":"password123"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer signupResp.Body.Close()
	if signupResp.StatusCode != http.StatusOK {
		t.Fatalf("signup status = %d", signupResp.StatusCode)
	}
	var signupBody map[string]map[string]any
	_ = json.NewDecoder(signupResp.Body).Decode(&signupBody)
	loginResp, err := http.Post(ts.URL+"/api/auth/login", "application/json", strings.NewReader(`{"email":"local@example.com","password":"password123"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer loginResp.Body.Close()
	var loginBody map[string]map[string]any
	_ = json.NewDecoder(loginResp.Body).Decode(&loginBody)
	if loginBody["user"]["user_id"] != signupBody["user"]["user_id"] || loginBody["user"]["auth_provider"] != "local" {
		t.Fatalf("unexpected login body: %+v", loginBody)
	}
	dupResp, err := http.Post(ts.URL+"/api/auth/signup", "application/json", strings.NewReader(`{"display_name":"Another User","email":"local@example.com","password":"password123"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer dupResp.Body.Close()
	if dupResp.StatusCode != http.StatusConflict {
		t.Fatalf("duplicate status = %d", dupResp.StatusCode)
	}
	var dupBody map[string]string
	_ = json.NewDecoder(dupResp.Body).Decode(&dupBody)
	if dupBody["detail"] != "account already exists" {
		t.Fatalf("unexpected duplicate body: %+v", dupBody)
	}
}

func TestAppServesBuiltFrontendWhenDistExists(t *testing.T) {
	ts, cfg := buildTestServer(t)
	defer ts.Close()
	if err := os.MkdirAll(filepath.Join(cfg.WebDistDir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfg.WebDistDir, "index.html"), []byte("<!doctype html><html><body>talk web</body></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfg.WebDistDir, "assets", "app.js"), []byte("console.log('talk');"), 0o644); err != nil {
		t.Fatal(err)
	}
	indexResp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer indexResp.Body.Close()
	assetResp, err := http.Get(ts.URL + "/assets/app.js")
	if err != nil {
		t.Fatal(err)
	}
	defer assetResp.Body.Close()
	indexBody, _ := io.ReadAll(indexResp.Body)
	assetBody, _ := io.ReadAll(assetResp.Body)
	if indexResp.StatusCode != http.StatusOK || !strings.Contains(string(indexBody), "talk web") {
		t.Fatalf("unexpected index response: %d %s", indexResp.StatusCode, string(indexBody))
	}
	if assetResp.StatusCode != http.StatusOK || !strings.Contains(string(assetBody), "console.log('talk');") {
		t.Fatalf("unexpected asset response: %d %s", assetResp.StatusCode, string(assetBody))
	}
}

func TestWebSocketGuestFlowStreamsTranslation(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	resp, err := http.Post(ts.URL+"/api/auth/guest", "application/json", strings.NewReader(`{"display_name":"Guest User"}`))
	if err != nil {
		t.Fatal(err)
	}
	cookie := findCookie(resp.Cookies(), "talk_session")
	if cookie == nil {
		t.Fatal("missing session cookie")
	}
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/chat/room-1?lang=en"
	dialer := websocket.Dialer{}
	headers := http.Header{}
	headers.Add("Cookie", cookie.String())
	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if err := conn.WriteJSON(map[string]any{"type": "send_message", "client_msg_id": "m1", "text": "hello", "source_lang": "en"}); err != nil {
		t.Fatal(err)
	}
	eventTypes := []string{}
	finalText := ""
	for range 4 {
		var payload map[string]any
		if err := conn.ReadJSON(&payload); err != nil {
			t.Fatal(err)
		}
		eventTypes = append(eventTypes, payload["t"].(string))
		if payload["t"] == "msg_final" {
			finalText = payload["text"].(string)
		}
	}
	joined := strings.Join(eventTypes, ",")
	if joined != "msg_start,msg_delta,msg_delta,msg_final" {
		t.Fatalf("unexpected event order: %s", joined)
	}
	if finalText != "[en] hello" {
		t.Fatalf("unexpected final text: %s", finalText)
	}
}

func findCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}

func TestSessionEndpointReturnsDirectUserObject(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	resp, err := http.Post(ts.URL+"/api/auth/guest", "application/json", strings.NewReader(`{"display_name":"Guest User"}`))
	if err != nil {
		t.Fatal(err)
	}
	cookie := findCookie(resp.Cookies(), "talk_session")
	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/auth/session", nil)
	req.AddCookie(cookie)
	sessionResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer sessionResp.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(sessionResp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if _, ok := body["user"]; ok {
		t.Fatalf("session response should not be wrapped: %+v", body)
	}
	if body["auth_provider"] != "guest" {
		t.Fatalf("unexpected session body: %+v", body)
	}
}

func TestUnauthenticatedWebSocketClosesWith4401(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/chat/room-1?lang=en"
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatal("expected handshake failure")
	}
	if resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 handshake rejection, got err=%v resp=%v", err, resp)
	}
}

func TestMetricsAndHealth(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	healthResp, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer healthResp.Body.Close()
	var health map[string]string
	_ = json.NewDecoder(healthResp.Body).Decode(&health)
	if health["status"] != "ok" || health["provider"] != "mock" {
		t.Fatalf("unexpected health: %+v", health)
	}
	metricsResp, err := http.Get(ts.URL + "/metrics")
	if err != nil {
		t.Fatal(err)
	}
	defer metricsResp.Body.Close()
	var metrics map[string]any
	_ = json.NewDecoder(metricsResp.Body).Decode(&metrics)
	if _, ok := metrics["counters"]; !ok {
		t.Fatalf("missing counters: %+v", metrics)
	}
	if _, ok := metrics["timings"]; !ok {
		t.Fatalf("missing timings: %+v", metrics)
	}
}

func TestStaticFallbackWhenDistMissing(t *testing.T) {
	ts, cfg := buildTestServer(t)
	defer ts.Close()
	_ = os.RemoveAll(cfg.WebDistDir)
	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body map[string]string
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body["message"] != "web build not found" {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestTargetLanguageBootstrapAndUpdate(t *testing.T) {
	ts, _ := buildTestServer(t)
	defer ts.Close()
	resp, err := http.Post(ts.URL+"/api/auth/guest", "application/json", strings.NewReader(`{"display_name":"Guest User"}`))
	if err != nil {
		t.Fatal(err)
	}
	cookie := findCookie(resp.Cookies(), "talk_session")
	if cookie == nil {
		t.Fatal("missing session cookie")
	}
	wsURLEN := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/chat/room-1?lang=en"
	wsURLKO := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/chat/room-1?lang=ko"
	headers := http.Header{"Cookie": []string{cookie.String()}}
	enConn, _, err := websocket.DefaultDialer.Dial(wsURLEN, headers)
	if err != nil {
		t.Fatal(err)
	}
	defer enConn.Close()
	koConn, _, err := websocket.DefaultDialer.Dial(wsURLKO, headers)
	if err != nil {
		t.Fatal(err)
	}
	defer koConn.Close()
	if err := enConn.WriteJSON(map[string]any{"type": "send_message", "client_msg_id": "m1", "text": "hello", "source_lang": "en"}); err != nil {
		t.Fatal(err)
	}
	finalTexts := map[string]string{}
	for i := 0; i < 4; i++ {
		var payload map[string]any
		if err := enConn.ReadJSON(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["t"] == "msg_final" {
			finalTexts["en"] = payload["text"].(string)
		}
	}
	for i := 0; i < 4; i++ {
		var payload map[string]any
		if err := koConn.ReadJSON(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["t"] == "msg_final" {
			finalTexts["ko"] = payload["text"].(string)
		}
	}
	if finalTexts["en"] != "[en] hello" || finalTexts["ko"] != "[ko] hello" {
		t.Fatalf("unexpected final texts: %+v", finalTexts)
	}
	if err := enConn.WriteJSON(map[string]any{"type": "set_target_lang", "target_lang": "ja"}); err != nil {
		t.Fatal(err)
	}
	if err := enConn.WriteJSON(map[string]any{"type": "send_message", "client_msg_id": "m2", "text": "again", "source_lang": "en"}); err != nil {
		t.Fatal(err)
	}
	observed := map[string]string{}
	for i := 0; i < 4; i++ {
		var payload map[string]any
		if err := enConn.ReadJSON(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["t"] == "msg_final" {
			observed["ja"] = payload["dst"].(string) + ":" + payload["text"].(string)
		}
	}
	for i := 0; i < 4; i++ {
		var payload map[string]any
		if err := koConn.ReadJSON(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["t"] == "msg_final" {
			observed["ko"] = payload["dst"].(string) + ":" + payload["text"].(string)
		}
	}
	if observed["ja"] != "ja:[ja] again" || observed["ko"] != "ko:[ko] again" {
		t.Fatalf("unexpected observed texts: %+v", observed)
	}
}

func _(_ url.URL) {}
