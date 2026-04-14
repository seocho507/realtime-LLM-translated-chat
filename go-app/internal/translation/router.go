package translation

import "sort"

type ProviderHealth struct {
	Available bool
	Reason    string
}
type ProviderPolicy struct {
	LatencyRank int
	CostRank    int
}

type TranslationRouter struct {
	adapters        map[string]TranslationLLM
	health          map[string]ProviderHealth
	defaultProvider string
	policies        map[string]ProviderPolicy
}

func NewTranslationRouter(adapters []TranslationLLM, defaultProvider string) *TranslationRouter {
	adapterMap := map[string]TranslationLLM{}
	health := map[string]ProviderHealth{}
	for _, adapter := range adapters {
		adapterMap[adapter.Provider()] = adapter
		health[adapter.Provider()] = ProviderHealth{Available: true}
	}
	return &TranslationRouter{adapters: adapterMap, health: health, defaultProvider: defaultProvider, policies: map[string]ProviderPolicy{
		"groq":      {LatencyRank: 1, CostRank: 1},
		"anthropic": {LatencyRank: 1, CostRank: 2},
		"openai":    {LatencyRank: 2, CostRank: 3},
		"mock":      {LatencyRank: 4, CostRank: 1},
	}}
}

func (r *TranslationRouter) SetHealth(provider string, available bool, reason string) {
	if _, ok := r.health[provider]; ok {
		r.health[provider] = ProviderHealth{Available: available, Reason: reason}
	}
}

func (r *TranslationRouter) Pick(req TranslationRequest) TranslationLLM {
	candidates := make([]TranslationLLM, 0, len(r.adapters))
	for provider, adapter := range r.adapters {
		health := r.health[provider]
		if !health.Available {
			continue
		}
		if req.Glossary != nil && !adapter.Capabilities().Glossary {
			continue
		}
		candidates = append(candidates, adapter)
	}
	if len(candidates) == 0 {
		return r.adapters[r.defaultProvider]
	}
	sort.Slice(candidates, func(i, j int) bool {
		left := r.policies[candidates[i].Provider()]
		right := r.policies[candidates[j].Provider()]
		if left.LatencyRank != right.LatencyRank {
			return left.LatencyRank < right.LatencyRank
		}
		if left.CostRank != right.CostRank {
			return left.CostRank < right.CostRank
		}
		if (candidates[i].Provider() == r.defaultProvider) != (candidates[j].Provider() == r.defaultProvider) {
			return candidates[i].Provider() == r.defaultProvider
		}
		return candidates[i].Provider() < candidates[j].Provider()
	})
	return candidates[0]
}
