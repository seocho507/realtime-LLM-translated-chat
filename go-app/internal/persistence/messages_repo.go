package persistence

import "database/sql"

type Message struct {
	ID             int64
	ConversationID string
	SenderID       string
	ClientMsgID    string
	OriginalText   string
	OriginalLang   string
	Status         string
}

type TranslationRecord struct {
	TargetLang          string
	TranslatedText      *string
	Provider            *string
	Model               *string
	PromptVersion       string
	Cached              bool
	LatencyFirstTokenMS *int
	LatencyTotalMS      *int
	ErrorCode           *string
}

type MessageRepository struct{ DB *sql.DB }

func NewMessageRepository(db *sql.DB) *MessageRepository { return &MessageRepository{DB: db} }

func (r *MessageRepository) SaveEnvelope(conversationID, senderID, clientMsgID, originalText, originalLang, status string) (int64, error) {
	result, err := r.DB.Exec(`INSERT INTO messages (conversation_id, sender_id, client_msg_id, original_text, original_lang, status) VALUES (?, ?, ?, ?, ?, ?)`, conversationID, senderID, clientMsgID, originalText, originalLang, status)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *MessageRepository) SaveTranslation(messageID int64, record TranslationRecord) error {
	if record.PromptVersion == "" {
		record.PromptVersion = "v1"
	}
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.Exec(`INSERT INTO message_translations (message_id, target_lang, translated_text, provider, model, prompt_version, cached, latency_first_token_ms, latency_total_ms, error_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		messageID, record.TargetLang, record.TranslatedText, record.Provider, record.Model, record.PromptVersion, boolToInt(record.Cached), record.LatencyFirstTokenMS, record.LatencyTotalMS, record.ErrorCode)
	if err != nil {
		return err
	}
	status := "translated"
	if record.ErrorCode != nil {
		status = "error"
	}
	_, err = tx.Exec(`UPDATE messages SET status = ? WHERE id = ?`, status, messageID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *MessageRepository) GetMessageByClientID(clientMsgID string) (*Message, error) {
	row := r.DB.QueryRow(`SELECT id, conversation_id, sender_id, client_msg_id, original_text, original_lang, status FROM messages WHERE client_msg_id = ?`, clientMsgID)
	var m Message
	if err := row.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.ClientMsgID, &m.OriginalText, &m.OriginalLang, &m.Status); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
