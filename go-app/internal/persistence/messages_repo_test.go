package persistence

import "testing"

func TestMessageRepositoryPersistsEnvelopeAndTranslation(t *testing.T) {
	db, err := Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.SQL.Close()
	if err := db.InitModels(); err != nil {
		t.Fatalf("init models: %v", err)
	}
	repo := NewMessageRepository(db.SQL)
	messageID, err := repo.SaveEnvelope("c1", "u1", "m1", "안녕하세요", "ko", "translating")
	if err != nil {
		t.Fatalf("save envelope: %v", err)
	}
	translatedText := "Hello"
	provider := "mock"
	model := "mock-sonnet"
	if err := repo.SaveTranslation(messageID, TranslationRecord{TargetLang: "en", TranslatedText: &translatedText, Provider: &provider, Model: &model, Cached: false}); err != nil {
		t.Fatalf("save translation: %v", err)
	}
	stored, err := repo.GetMessageByClientID("m1")
	if err != nil {
		t.Fatalf("get message: %v", err)
	}
	if stored == nil || stored.ID != messageID || stored.Status != "translated" {
		t.Fatalf("unexpected stored message: %+v", stored)
	}
}
