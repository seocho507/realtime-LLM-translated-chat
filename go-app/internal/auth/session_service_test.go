package auth

import "testing"

func TestSessionServiceIssuesAndVerifiesToken(t *testing.T) {
	service := NewSessionService("test-secret", 300)
	token, principal, err := service.Issue("google-sub-1", "user@example.com")
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	verified := service.Verify(token)
	if verified == nil {
		t.Fatal("expected verified principal")
	}
	if verified.UserID != principal.UserID || verified.AuthProvider != "google" || verified.DisplayName != "user@example.com" {
		t.Fatalf("unexpected verified principal: %+v", verified)
	}
	if verified.GoogleSub == nil || *verified.GoogleSub != "google-sub-1" {
		t.Fatalf("unexpected google_sub: %+v", verified.GoogleSub)
	}
}

func TestSessionServiceIssuesGuestToken(t *testing.T) {
	service := NewSessionService("test-secret", 300)
	token, principal, err := service.IssueGuest("Guest User")
	if err != nil {
		t.Fatalf("issue guest token: %v", err)
	}
	verified := service.Verify(token)
	if verified == nil {
		t.Fatal("expected verified principal")
	}
	if verified.UserID != principal.UserID || verified.AuthProvider != "guest" || verified.DisplayName != "Guest User" {
		t.Fatalf("unexpected guest principal: %+v", verified)
	}
	if verified.GoogleSub != nil || verified.Email != nil {
		t.Fatalf("expected nil google_sub/email: %+v", verified)
	}
}
