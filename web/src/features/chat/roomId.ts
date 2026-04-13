export const DEFAULT_ROOM_ID = 'demo-room'

export function normalizeRoomId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
  return normalized || DEFAULT_ROOM_ID
}

export function getRoomIdFromLocation(search: string): string {
  const params = new URLSearchParams(search)
  return normalizeRoomId(params.get('room') ?? DEFAULT_ROOM_ID)
}

export function syncRoomIdToUrl(roomId: string) {
  const url = new URL(window.location.href)
  if (roomId === DEFAULT_ROOM_ID) {
    url.searchParams.delete('room')
  } else {
    url.searchParams.set('room', roomId)
  }
  window.history.replaceState({}, '', url)
}
