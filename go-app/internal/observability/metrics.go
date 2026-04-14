package observability

import "sync"

type MetricsRegistry struct {
	mu       sync.Mutex
	Counters map[string]int   `json:"counters"`
	Timings  map[string][]int `json:"timings"`
}

func NewMetricsRegistry() *MetricsRegistry {
	return &MetricsRegistry{
		Counters: map[string]int{},
		Timings:  map[string][]int{},
	}
}

func (m *MetricsRegistry) Increment(name string, value int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Counters[name] += value
}

func (m *MetricsRegistry) Observe(name string, value int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Timings[name] = append(m.Timings[name], value)
}

func (m *MetricsRegistry) Snapshot() map[string]any {
	m.mu.Lock()
	defer m.mu.Unlock()
	counters := make(map[string]int, len(m.Counters))
	for k, v := range m.Counters {
		counters[k] = v
	}
	timings := make(map[string][]int, len(m.Timings))
	for k, values := range m.Timings {
		copied := append([]int(nil), values...)
		timings[k] = copied
	}
	return map[string]any{"counters": counters, "timings": timings}
}
