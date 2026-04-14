package persistence

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
)

type LocalUser struct {
	ID           int64
	UserID       string
	AuthProvider string
	DisplayName  string
	Email        string
	PasswordHash string
}

type UserRepository struct {
	DB *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{DB: db}
}

func (r *UserRepository) GetByEmail(email string) (*LocalUser, error) {
	row := r.DB.QueryRow(`SELECT id, user_id, auth_provider, display_name, email, password_hash FROM local_users WHERE email = ?`, email)
	var user LocalUser
	if err := row.Scan(&user.ID, &user.UserID, &user.AuthProvider, &user.DisplayName, &user.Email, &user.PasswordHash); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) CreateLocalUser(email, displayName, passwordHash string) (*LocalUser, error) {
	userID := hex.EncodeToString(r.randomBytes(8))
	result, err := r.DB.Exec(`INSERT INTO local_users (user_id, auth_provider, display_name, email, password_hash) VALUES (?, 'local', ?, ?, ?)`, userID, displayName, email, passwordHash)
	if err != nil {
		return nil, err
	}
	id, _ := result.LastInsertId()
	return &LocalUser{ID: id, UserID: userID, AuthProvider: "local", DisplayName: displayName, Email: email, PasswordHash: passwordHash}, nil
}

func (r *UserRepository) randomBytes(n int) []byte {
	out := make([]byte, n)
	if _, err := rand.Read(out); err != nil {
		panic(err)
	}
	return out
}
