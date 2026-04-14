package persistence

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	SQL *sql.DB
}

func Open(databaseURL string) (*DB, error) {
	dsn := normalizeSQLiteDSN(databaseURL)
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		return nil, err
	}
	return &DB{SQL: db}, nil
}

func normalizeSQLiteDSN(databaseURL string) string {
	if strings.HasPrefix(databaseURL, "sqlite+aiosqlite:///") {
		trimmed := strings.TrimPrefix(databaseURL, "sqlite+aiosqlite:///")
		if strings.HasPrefix(trimmed, ":") {
			return trimmed
		}
		return fmt.Sprintf("%s?_busy_timeout=5000&_foreign_keys=on", trimmed)
	}
	if strings.HasPrefix(databaseURL, "./") || strings.HasPrefix(databaseURL, "/") || strings.HasPrefix(databaseURL, ":memory:") {
		if databaseURL == ":memory:" {
			return "file::memory:?cache=shared"
		}
		return fmt.Sprintf("%s?_busy_timeout=5000&_foreign_keys=on", databaseURL)
	}
	return databaseURL
}

func (db *DB) InitModels() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            client_msg_id TEXT NOT NULL UNIQUE,
            original_text TEXT NOT NULL,
            original_lang TEXT NOT NULL DEFAULT 'auto',
            status TEXT NOT NULL DEFAULT 'translating',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`,
		`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);`,
		`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);`,
		`CREATE INDEX IF NOT EXISTS idx_messages_client_msg_id ON messages(client_msg_id);`,
		`CREATE TABLE IF NOT EXISTS message_translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            target_lang TEXT NOT NULL,
            translated_text TEXT NULL,
            provider TEXT NULL,
            model TEXT NULL,
            prompt_version TEXT NOT NULL DEFAULT 'v1',
            cached BOOLEAN NOT NULL DEFAULT 0,
            latency_first_token_ms INTEGER NULL,
            latency_total_ms INTEGER NULL,
            error_code TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(message_id) REFERENCES messages(id)
        );`,
		`CREATE INDEX IF NOT EXISTS idx_message_translations_message_id ON message_translations(message_id);`,
		`CREATE TABLE IF NOT EXISTS local_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            auth_provider TEXT NOT NULL DEFAULT 'local',
            display_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`,
		`CREATE INDEX IF NOT EXISTS idx_local_users_user_id ON local_users(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_local_users_email ON local_users(email);`,
	}
	for _, stmt := range statements {
		if _, err := db.SQL.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}
