package translation

type LLMMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type TranslationRequest struct {
	RequestID       string            `json:"request_id"`
	SourceLang      string            `json:"source_lang"`
	TargetLang      string            `json:"target_lang"`
	Text            string            `json:"text"`
	Context         []LLMMessage      `json:"context"`
	Tone            *string           `json:"tone,omitempty"`
	Glossary        map[string]string `json:"glossary,omitempty"`
	MaxOutputTokens int               `json:"max_output_tokens"`
	Temperature     float64           `json:"temperature"`
	Metadata        map[string]string `json:"metadata"`
}

type StreamStart struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}
type StreamDelta struct {
	Text string `json:"text"`
}
type StreamFinal struct {
	Text                string `json:"text"`
	FinishReason        string `json:"finish_reason"`
	InputTokens         *int   `json:"input_tokens,omitempty"`
	OutputTokens        *int   `json:"output_tokens,omitempty"`
	LatencyFirstTokenMS *int   `json:"latency_first_token_ms,omitempty"`
	LatencyTotalMS      *int   `json:"latency_total_ms,omitempty"`
	Cached              bool   `json:"cached"`
}
type StreamError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

type ModelCapabilities struct {
	Streaming        bool
	Glossary         bool
	JSONMode         bool
	PromptCaching    bool
	MaxContextTokens *int
}

type StreamEvent interface{}

type TranslationLLM interface {
	Provider() string
	Model() string
	Capabilities() ModelCapabilities
	TranslateStream(req TranslationRequest) ([]StreamEvent, error)
}

type TranslationCache interface {
	Get(key string) map[string]any
	Set(key string, value map[string]any, ttlSeconds int)
}
