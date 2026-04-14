package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

type GoogleVerifier interface {
	VerifyToken(credential string) (GoogleIdentity, error)
}

type HTTPGoogleVerifier struct {
	Client        *http.Client
	ClientID      string
	AllowedDomain string
}

func (h *HTTPGoogleVerifier) VerifyToken(credential string) (GoogleIdentity, error) {
	client := h.Client
	if client == nil {
		client = http.DefaultClient
	}
	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(credential)
	resp, err := client.Get(endpoint)
	if err != nil {
		return GoogleIdentity{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		class := "Client"
		if resp.StatusCode >= 500 {
			class = "Server"
		}
		return GoogleIdentity{}, fmt.Errorf("%s error '%d %s' for url '%s'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/%d", class, resp.StatusCode, http.StatusText(resp.StatusCode), endpoint, resp.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return GoogleIdentity{}, err
	}
	audience, _ := payload["aud"].(string)
	if h.ClientID != "" && audience != h.ClientID {
		return GoogleIdentity{}, fmt.Errorf("google audience mismatch")
	}
	hostedDomain, _ := payload["hd"].(string)
	if h.AllowedDomain != "" && hostedDomain != h.AllowedDomain {
		return GoogleIdentity{}, fmt.Errorf("google hosted domain mismatch")
	}
	email, _ := payload["email"].(string)
	sub, _ := payload["sub"].(string)
	if email == "" || sub == "" {
		return GoogleIdentity{}, fmt.Errorf("google token missing required claims")
	}
	identity := GoogleIdentity{Sub: sub, Email: email}
	if v, ok := payload["name"].(string); ok && v != "" {
		identity.Name = &v
	}
	if v, ok := payload["picture"].(string); ok && v != "" {
		identity.Picture = &v
	}
	return identity, nil
}
