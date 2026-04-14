package realtime

import (
	"sync"

	"github.com/gorilla/websocket"
)

type RoomConnection struct {
	TargetLang string
}

type ConnectionManager struct {
	mu    sync.Mutex
	rooms map[string]map[*websocket.Conn]RoomConnection
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{rooms: map[string]map[*websocket.Conn]RoomConnection{}}
}

func (m *ConnectionManager) Connect(conversationID string, conn *websocket.Conn, targetLang string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if targetLang == "" {
		targetLang = "en"
	}
	room := m.rooms[conversationID]
	if room == nil {
		room = map[*websocket.Conn]RoomConnection{}
		m.rooms[conversationID] = room
	}
	room[conn] = RoomConnection{TargetLang: targetLang}
}

func (m *ConnectionManager) Disconnect(conversationID string, conn *websocket.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[conversationID]
	if room == nil {
		return
	}
	delete(room, conn)
	if len(room) == 0 {
		delete(m.rooms, conversationID)
	}
}

func (m *ConnectionManager) UpdateTargetLang(conversationID string, conn *websocket.Conn, targetLang string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[conversationID]
	if room == nil || targetLang == "" {
		return
	}
	state, ok := room[conn]
	if !ok {
		return
	}
	state.TargetLang = targetLang
	room[conn] = state
}

func (m *ConnectionManager) SnapshotTargetGroups(conversationID string) map[string][]*websocket.Conn {
	m.mu.Lock()
	defer m.mu.Unlock()
	grouped := map[string][]*websocket.Conn{}
	for conn, state := range m.rooms[conversationID] {
		grouped[state.TargetLang] = append(grouped[state.TargetLang], conn)
	}
	return grouped
}

func (m *ConnectionManager) Send(conversationID string, conns []*websocket.Conn, payload map[string]any) {
	for _, conn := range conns {
		if err := conn.WriteJSON(payload); err != nil {
			m.Disconnect(conversationID, conn)
			conn.Close()
		}
	}
}
