package orchestration

import (
	"sort"
	"time"

	"github.com/gorilla/websocket"

	"talk/go-app/internal/auth"
	"talk/go-app/internal/observability"
	"talk/go-app/internal/persistence"
	"talk/go-app/internal/realtime"
	"talk/go-app/internal/translation"
)

type ChatInboundMessage struct {
	ClientMsgID string `json:"client_msg_id"`
	Text        string `json:"text"`
	SourceLang  string `json:"source_lang"`
}

type MessageOrchestrator struct {
	connections *realtime.ConnectionManager
	translation *translation.TranslationService
	repository  *persistence.MessageRepository
	metrics     *observability.MetricsRegistry
}

func NewMessageOrchestrator(connections *realtime.ConnectionManager, translationService *translation.TranslationService, repository *persistence.MessageRepository, metrics *observability.MetricsRegistry) *MessageOrchestrator {
	return &MessageOrchestrator{connections: connections, translation: translationService, repository: repository, metrics: metrics}
}

func (m *MessageOrchestrator) HandleMessage(conversationID string, principal auth.SessionPrincipal, message ChatInboundMessage) {
	started := time.Now()
	if message.SourceLang == "" {
		message.SourceLang = "auto"
	}
	messageID, err := m.repository.SaveEnvelope(conversationID, principal.UserID, message.ClientMsgID, message.Text, message.SourceLang, "translating")
	if err != nil {
		return
	}
	targetGroups := m.connections.SnapshotTargetGroups(conversationID)
	if len(targetGroups) == 0 {
		return
	}
	targetLangs := make([]string, 0, len(targetGroups))
	for targetLang := range targetGroups {
		targetLangs = append(targetLangs, targetLang)
	}
	sort.Strings(targetLangs)
	for _, targetLang := range targetLangs {
		websockets := targetGroups[targetLang]
		m.connections.Send(conversationID, websockets, realtime.ToPayload("msg_start", map[string]any{
			"id":                  message.ClientMsgID,
			"original":            message.Text,
			"src":                 message.SourceLang,
			"dst":                 targetLang,
			"status":              "translating",
			"sender_id":           principal.UserID,
			"sender_display_name": principal.DisplayName,
			"sender_email":        principal.Email,
		}))
	}
	m.metrics.Observe("original_delivery_ms", int(time.Since(started).Milliseconds()))
	for _, targetLang := range targetLangs {
		websockets := targetGroups[targetLang]
		m.translateForTargetGroup(conversationID, messageID, message.ClientMsgID, message.Text, message.SourceLang, targetLang, websockets, true)
	}
}

func (m *MessageOrchestrator) translateForTargetGroup(conversationID string, messageID int64, clientMsgID, text, sourceLang, targetLang string, websockets []*websocket.Conn, persist bool) {
	req := translation.TranslationRequest{RequestID: clientMsgID + ":" + targetLang, SourceLang: sourceLang, TargetLang: targetLang, Text: text, MaxOutputTokens: 1536, Temperature: 0.0, Metadata: map[string]string{"prompt_version": "v1"}}
	events, err := m.translation.Translate(req)
	provider := ""
	model := ""
	if err != nil {
		code := translation.ProviderUnavailable
		m.recordTranslationError(conversationID, messageID, clientMsgID, targetLang, code, nilIfEmpty(provider), nilIfEmpty(model), websockets, persist)
		return
	}
	for _, event := range events {
		switch v := event.(type) {
		case translation.StreamStart:
			provider, model = v.Provider, v.Model
		case translation.StreamDelta:
			m.connections.Send(conversationID, websockets, realtime.ToPayload("msg_delta", map[string]any{"id": clientMsgID, "text": v.Text, "dst": targetLang}))
		case translation.StreamFinal:
			if v.LatencyFirstTokenMS != nil {
				m.metrics.Observe("translation_ttft_ms", *v.LatencyFirstTokenMS)
			}
			if v.LatencyTotalMS != nil {
				m.metrics.Observe("translation_full_ms", *v.LatencyTotalMS)
			}
			if persist {
				_ = m.repository.SaveTranslation(messageID, persistence.TranslationRecord{TargetLang: targetLang, TranslatedText: &v.Text, Provider: nilIfEmpty(provider), Model: nilIfEmpty(model), Cached: v.Cached, LatencyFirstTokenMS: v.LatencyFirstTokenMS, LatencyTotalMS: v.LatencyTotalMS})
			}
			m.connections.Send(conversationID, websockets, realtime.ToPayload("msg_final", map[string]any{"id": clientMsgID, "text": v.Text, "provider": nilIfEmpty(provider), "model": nilIfEmpty(model), "dst": targetLang}))
		case translation.StreamError:
			m.recordTranslationError(conversationID, messageID, clientMsgID, targetLang, v.Code, nilIfEmpty(provider), nilIfEmpty(model), websockets, persist)
		}
	}
}

func (m *MessageOrchestrator) recordTranslationError(conversationID string, messageID int64, clientMsgID, targetLang, code string, provider, model *string, websockets []*websocket.Conn, persist bool) {
	m.metrics.Increment("llm_provider_error_rate", 1)
	if persist {
		_ = m.repository.SaveTranslation(messageID, persistence.TranslationRecord{TargetLang: targetLang, Provider: provider, Model: model, ErrorCode: &code})
	}
	m.connections.Send(conversationID, websockets, realtime.ToPayload("msg_error", map[string]any{"id": clientMsgID, "code": code, "fallback": "original_only", "dst": targetLang}))
}

func nilIfEmpty(value string) *string {
	if value == "" {
		return nil
	}
	out := value
	return &out
}
