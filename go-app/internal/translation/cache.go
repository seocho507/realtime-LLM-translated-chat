package translation

import (
	"sync"
	"time"
)

type cacheEntry struct {
	ExpiresAt time.Time
	Value     map[string]any
}

type MemoryTranslationCache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
}

func NewMemoryTranslationCache() *MemoryTranslationCache {
	return &MemoryTranslationCache{entries: map[string]cacheEntry{}}
}

func (c *MemoryTranslationCache) Get(key string) map[string]any {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[key]
	if !ok {
		return nil
	}
	if time.Now().After(entry.ExpiresAt) {
		delete(c.entries, key)
		return nil
	}
	return entry.Value
}

func (c *MemoryTranslationCache) Set(key string, value map[string]any, ttlSeconds int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = cacheEntry{ExpiresAt: time.Now().Add(time.Duration(ttlSeconds) * time.Second), Value: value}
}
