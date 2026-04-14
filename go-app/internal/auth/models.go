package auth

type SessionPrincipal struct {
	SessionID    string  `json:"session_id"`
	UserID       string  `json:"user_id"`
	AuthProvider string  `json:"auth_provider"`
	DisplayName  string  `json:"display_name"`
	GoogleSub    *string `json:"google_sub"`
	Email        *string `json:"email"`
	ExpiresAt    int64   `json:"expires_at"`
}

type GoogleIdentity struct {
	Sub     string
	Email   string
	Name    *string
	Picture *string
}

type AuthUserResponse struct {
	SessionID    string  `json:"session_id"`
	UserID       string  `json:"user_id"`
	AuthProvider string  `json:"auth_provider"`
	DisplayName  string  `json:"display_name"`
	GoogleSub    *string `json:"google_sub"`
	Email        *string `json:"email"`
	ExpiresAt    int64   `json:"expires_at"`
}

type WrappedAuthResponse struct {
	User AuthUserResponse `json:"user"`
}

func ToAuthUserResponse(principal SessionPrincipal) AuthUserResponse {
	return AuthUserResponse{
		SessionID:    principal.SessionID,
		UserID:       principal.UserID,
		AuthProvider: principal.AuthProvider,
		DisplayName:  principal.DisplayName,
		GoogleSub:    principal.GoogleSub,
		Email:        principal.Email,
		ExpiresAt:    principal.ExpiresAt,
	}
}
