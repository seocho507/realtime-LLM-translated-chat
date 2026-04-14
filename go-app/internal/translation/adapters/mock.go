package adapters

import (
	"fmt"
	"time"

	"talk/go-app/internal/translation"
)

type MockTranslationAdapter struct{}

func (a *MockTranslationAdapter) Provider() string { return "mock" }
func (a *MockTranslationAdapter) Model() string    { return "mock-sonnet" }
func (a *MockTranslationAdapter) Capabilities() translation.ModelCapabilities {
	return translation.ModelCapabilities{Streaming: true, Glossary: true}
}
func (a *MockTranslationAdapter) TranslateStream(req translation.TranslationRequest) ([]translation.StreamEvent, error) {
	translated := fmt.Sprintf("[%s] %s", req.TargetLang, req.Text)
	halfway := len(translated) / 2
	if halfway < 1 {
		halfway = 1
	}
	total := int(time.Millisecond)
	first := 1
	return []translation.StreamEvent{
		translation.StreamStart{Provider: a.Provider(), Model: a.Model()},
		translation.StreamDelta{Text: translated[:halfway]},
		translation.StreamDelta{Text: translated[halfway:]},
		translation.StreamFinal{Text: translated, FinishReason: "stop", LatencyFirstTokenMS: &first, LatencyTotalMS: &total},
	}, nil
}
