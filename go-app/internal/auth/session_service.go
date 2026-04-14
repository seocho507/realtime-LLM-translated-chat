package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type SessionService struct {
	secret     []byte
	ttlSeconds int64
}

func NewSessionService(secret string, ttlSeconds int) *SessionService {
	return &SessionService{
		secret:     []byte(secret),
		ttlSeconds: int64(ttlSeconds),
	}
}

func (s *SessionService) Issue(googleSub, email string) (string, SessionPrincipal, error) {
	return s.IssueGoogle(googleSub, email)
}

func (s *SessionService) IssueGoogle(googleSub, email string) (string, SessionPrincipal, error) {
	now := time.Now().Unix()
	googleSubCopy := googleSub
	emailCopy := email
	principal := SessionPrincipal{
		SessionID:    s.tokenURLSafe(16),
		UserID:       shortHexHash(googleSub),
		AuthProvider: "google",
		DisplayName:  email,
		GoogleSub:    &googleSubCopy,
		Email:        &emailCopy,
		ExpiresAt:    now + s.ttlSeconds,
	}
	token, err := s.encode(principal)
	return token, principal, err
}

func (s *SessionService) IssueLocal(userID, email, displayName string) (string, SessionPrincipal, error) {
	now := time.Now().Unix()
	emailCopy := email
	principal := SessionPrincipal{
		SessionID:    s.tokenURLSafe(16),
		UserID:       userID,
		AuthProvider: "local",
		DisplayName:  displayName,
		Email:        &emailCopy,
		ExpiresAt:    now + s.ttlSeconds,
	}
	token, err := s.encode(principal)
	return token, principal, err
}

func (s *SessionService) IssueGuest(displayName string) (string, SessionPrincipal, error) {
	now := time.Now().Unix()
	guestID := "guest:" + s.tokenURLSafe(16)
	if strings.TrimSpace(displayName) == "" {
		displayName = fmt.Sprintf("Guest %s", strings.ToUpper(hex.EncodeToString(s.randomBytes(2))))
	}
	principal := SessionPrincipal{
		SessionID:    s.tokenURLSafe(16),
		UserID:       shortHexHash(guestID),
		AuthProvider: "guest",
		DisplayName:  displayName,
		ExpiresAt:    now + s.ttlSeconds,
	}
	token, err := s.encode(principal)
	return token, principal, err
}

func (s *SessionService) Verify(token string) *SessionPrincipal {
	payload, signature, ok := strings.Cut(token, ".")
	if !ok {
		return nil
	}
	expected := s.sign(payload)
	if subtle.ConstantTimeCompare([]byte(signature), []byte(expected)) != 1 {
		return nil
	}
	data, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return nil
	}
	var principal SessionPrincipal
	if err := json.Unmarshal(data, &principal); err != nil {
		return nil
	}
	if principal.ExpiresAt < time.Now().Unix() {
		return nil
	}
	return &principal
}

func (s *SessionService) encode(principal SessionPrincipal) (string, error) {
	data, err := json.Marshal(principal)
	if err != nil {
		return "", err
	}
	payload := base64.URLEncoding.EncodeToString(data)
	return payload + "." + s.sign(payload), nil
}

func (s *SessionService) sign(payload string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	return base64.URLEncoding.EncodeToString(mac.Sum(nil))
}

func shortHexHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])[:16]
}

func (s *SessionService) tokenURLSafe(n int) string {
	return base64.URLEncoding.EncodeToString(s.randomBytes(n))
}

func (s *SessionService) randomBytes(n int) []byte {
	result := make([]byte, n)
	if _, err := rand.Read(result); err != nil {
		panic(err)
	}
	return result
}
