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

export function buildChatPath(roomId: string): string {
  return `/chat/${normalizeRoomId(roomId)}`
}

export function getLegacyRoomIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  const roomId = params.get('room')
  if (!roomId) {
    return null
  }
  return normalizeRoomId(roomId)
}

export function getNormalizedRoomIdParam(roomId: string | undefined): string {
  return normalizeRoomId(roomId ?? DEFAULT_ROOM_ID)
}
