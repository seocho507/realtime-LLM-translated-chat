package httpapi

import (
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"talk/go-app/internal/auth"
	"talk/go-app/internal/config"
	"talk/go-app/internal/observability"
	"talk/go-app/internal/orchestration"
	"talk/go-app/internal/persistence"
	"talk/go-app/internal/realtime"
)

type Server struct {
	Config         config.Config
	Metrics        *observability.MetricsRegistry
	SessionService *auth.SessionService
	Passwords      *auth.PasswordService
	GoogleVerifier auth.GoogleVerifier
	Users          *persistence.UserRepository
	Messages       *persistence.MessageRepository
	Connections    *realtime.ConnectionManager
	Orchestrator   *orchestration.MessageOrchestrator
	upgrader       websocket.Upgrader
}

func NewServer(cfg config.Config, metrics *observability.MetricsRegistry, sessions *auth.SessionService, passwords *auth.PasswordService, google auth.GoogleVerifier, users *persistence.UserRepository, messages *persistence.MessageRepository, connections *realtime.ConnectionManager, orchestrator *orchestration.MessageOrchestrator) *Server {
	return &Server{Config: cfg, Metrics: metrics, SessionService: sessions, Passwords: passwords, GoogleVerifier: google, Users: users, Messages: messages, Connections: connections, Orchestrator: orchestrator, upgrader: websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/metrics", s.handleMetrics)
	mux.HandleFunc("/api/auth/google", s.handleGoogleLogin)
	mux.HandleFunc("/api/auth/guest", s.handleGuestLogin)
	mux.HandleFunc("/api/auth/signup", s.handleSignup)
	mux.HandleFunc("/api/auth/login", s.handleLogin)
	mux.HandleFunc("/api/auth/logout", s.handleLogout)
	mux.HandleFunc("/api/auth/session", s.handleSession)
	mux.HandleFunc("/ws/chat/", s.handleChatSocket)
	mux.HandleFunc("/", s.handleStatic)
	return withCORS(mux, s.Config)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, struct {
		Status   string `json:"status"`
		Provider string `json:"provider"`
	}{Status: "ok", Provider: s.Config.DefaultProvider})
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	snapshot := s.Metrics.Snapshot()
	writeJSON(w, http.StatusOK, struct {
		Counters map[string]int   `json:"counters"`
		Timings  map[string][]int `json:"timings"`
	}{
		Counters: snapshot["counters"].(map[string]int),
		Timings:  snapshot["timings"].(map[string][]int),
	})
}

func (s *Server) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Credential string `json:"credential"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	identity, err := s.GoogleVerifier.VerifyToken(body.Credential)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "google auth failed: "+err.Error())
		return
	}
	token, principal, err := s.SessionService.Issue(identity.Sub, identity.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.setSessionCookie(w, token)
	writeJSON(w, http.StatusOK, auth.WrappedAuthResponse{User: auth.ToAuthUserResponse(principal)})
}

func (s *Server) handleGuestLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DisplayName *string `json:"display_name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	displayName := ""
	if body.DisplayName != nil {
		displayName = *body.DisplayName
	}
	token, principal, err := s.SessionService.IssueGuest(displayName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.setSessionCookie(w, token)
	writeJSON(w, http.StatusOK, auth.WrappedAuthResponse{User: auth.ToAuthUserResponse(principal)})
}

func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string  `json:"email"`
		Password    string  `json:"password"`
		DisplayName *string `json:"display_name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	email := auth.NormalizeEmail(body.Email)
	if err := auth.ValidateLocalCredentials(email, body.Password); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	existing, err := s.Users.GetByEmail(email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existing != nil {
		writeError(w, http.StatusConflict, "account already exists")
		return
	}
	displayName := auth.ResolveDisplayName(valueOrEmpty(body.DisplayName), email)
	passwordHash, err := s.Passwords.HashPassword(body.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	user, err := s.Users.CreateLocalUser(email, displayName, passwordHash)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	token, principal, err := s.SessionService.IssueLocal(user.UserID, user.Email, user.DisplayName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.setSessionCookie(w, token)
	writeJSON(w, http.StatusOK, auth.WrappedAuthResponse{User: auth.ToAuthUserResponse(principal)})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	email := auth.NormalizeEmail(body.Email)
	if err := auth.ValidateLocalCredentials(email, body.Password); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := s.Users.GetByEmail(email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil || !s.Passwords.VerifyPassword(body.Password, user.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	token, principal, err := s.SessionService.IssueLocal(user.UserID, user.Email, user.DisplayName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.setSessionCookie(w, token)
	writeJSON(w, http.StatusOK, auth.WrappedAuthResponse{User: auth.ToAuthUserResponse(principal)})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Set-Cookie", buildDeleteSessionCookieHeader(s.Config))
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	principal := s.currentPrincipal(r)
	if principal == nil {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	writeJSON(w, http.StatusOK, auth.ToAuthUserResponse(*principal))
}

func (s *Server) handleChatSocket(w http.ResponseWriter, r *http.Request) {
	principal := s.currentPrincipal(r)
	if principal == nil {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return
	}
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	conversationID := strings.TrimPrefix(r.URL.Path, "/ws/chat/")
	if conversationID == "" {
		conn.Close()
		return
	}
	targetLang := r.URL.Query().Get("lang")
	if targetLang == "" {
		targetLang = "en"
	}
	s.Connections.Connect(conversationID, conn, targetLang)
	defer func() {
		s.Metrics.Increment("ws_disconnect_rate", 1)
		s.Connections.Disconnect(conversationID, conn)
		conn.Close()
	}()
	for {
		var payload map[string]any
		if err := conn.ReadJSON(&payload); err != nil {
			break
		}
		payloadType, _ := payload["type"].(string)
		switch payloadType {
		case "set_target_lang":
			if value, ok := payload["target_lang"].(string); ok {
				s.Connections.UpdateTargetLang(conversationID, conn, value)
			}
		case "send_message":
			text, _ := payload["text"].(string)
			clientMsgID, _ := payload["client_msg_id"].(string)
			sourceLang, _ := payload["source_lang"].(string)
			if sourceLang == "" {
				sourceLang = "auto"
			}
			s.Orchestrator.HandleMessage(conversationID, *principal, orchestration.ChatInboundMessage{ClientMsgID: clientMsgID, Text: text, SourceLang: sourceLang})
		}
	}
}

func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	dist := s.Config.WebDistDir
	if info, err := os.Stat(dist); err != nil || !info.IsDir() {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "web build not found", "expected_dist_dir": dist})
		return
	}
	requested := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
	if requested == "." || requested == "" {
		indexPath := filepath.Join(dist, "index.html")
		if etag, ok := computeETag(indexPath); ok {
			w.Header().Set("etag", fmt.Sprintf("\"%s\"", etag))
		}
		http.ServeFile(w, r, indexPath)
		return
	}
	candidate := filepath.Join(dist, requested)
	if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
		if etag, ok := computeETag(candidate); ok {
			w.Header().Set("etag", fmt.Sprintf("\"%s\"", etag))
		}
		http.ServeFile(w, r, candidate)
		return
	}
	indexPath := filepath.Join(dist, "index.html")
	if etag, ok := computeETag(indexPath); ok {
		w.Header().Set("etag", fmt.Sprintf("\"%s\"", etag))
	}
	http.ServeFile(w, r, indexPath)
}

func (s *Server) currentPrincipal(r *http.Request) *auth.SessionPrincipal {
	cookie, err := r.Cookie(s.Config.SessionCookieName)
	if err != nil {
		return nil
	}
	return s.SessionService.Verify(cookie.Value)
}

func (s *Server) setSessionCookie(w http.ResponseWriter, token string) {
	w.Header().Add("Set-Cookie", buildSessionCookieHeader(s.Config, token))
}

func withCORS(next http.Handler, cfg config.Config) http.Handler {
	allowed := map[string]struct{}{}
	for _, origin := range cfg.CORSAllowedOrigins {
		allowed[origin] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, ok := allowed[origin]; ok {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "*")
			w.Header().Set("Access-Control-Allow-Headers", "*")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func buildSessionCookieHeader(cfg config.Config, token string) string {
	parts := []string{
		fmt.Sprintf("%s=%s", cfg.SessionCookieName, token),
		"HttpOnly",
		fmt.Sprintf("Max-Age=%d", cfg.SessionTTLSeconds),
		"Path=/",
		fmt.Sprintf("SameSite=%s", cfg.SessionCookieSameSite),
	}
	if cfg.SessionCookieSecure {
		parts = append(parts, "Secure")
	}
	return strings.Join(parts, "; ")
}

func buildDeleteSessionCookieHeader(cfg config.Config) string {
	expires := time.Now().UTC().Format(http.TimeFormat)
	parts := []string{
		fmt.Sprintf("%s=\"\"", cfg.SessionCookieName),
		fmt.Sprintf("expires=%s", expires),
		"HttpOnly",
		"Max-Age=0",
		"Path=/",
		fmt.Sprintf("SameSite=%s", cfg.SessionCookieSameSite),
	}
	if cfg.SessionCookieSecure {
		parts = append(parts, "Secure")
	}
	return strings.Join(parts, "; ")
}

func computeETag(path string) (string, bool) {
	info, err := os.Stat(path)
	if err != nil {
		return "", false
	}
	sum := md5.Sum([]byte(fmt.Sprintf("%f-%d", float64(info.ModTime().UnixNano())/1e9, info.Size())))
	return fmt.Sprintf("%x", sum), true
}

func decodeJSON(r *http.Request, dest any) error {
	if r.Body == nil {
		return errors.New("request body is required")
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dest)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	payload, err := json.Marshal(body)
	if err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(payload)
}

func writeError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, map[string]string{"detail": detail})
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
