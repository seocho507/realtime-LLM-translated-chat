import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ROOM_ID,
  buildChatPath,
  getLegacyRoomIdFromSearch,
  getNormalizedRoomIdParam,
  normalizeRoomId,
} from './roomId'

describe('roomId helpers', () => {
  it('normalizes a room id into a url-safe slug', () => {
    expect(normalizeRoomId(' Team Alpha / 01 ')).toBe('team-alpha-01')
  })

  it('falls back to the default room id when the value is empty', () => {
    expect(normalizeRoomId('   ')).toBe(DEFAULT_ROOM_ID)
  })

  it('builds a canonical chat path', () => {
    expect(buildChatPath(' Project One ')).toBe('/chat/project-one')
  })

  it('reads a legacy room id from query-string links', () => {
    expect(getLegacyRoomIdFromSearch('?room=Project%20One')).toBe('project-one')
  })

  it('returns null when no legacy room id is present', () => {
    expect(getLegacyRoomIdFromSearch('')).toBeNull()
  })

  it('normalizes path params and falls back to the default room id', () => {
    expect(getNormalizedRoomIdParam('Team Alpha')).toBe('team-alpha')
    expect(getNormalizedRoomIdParam(undefined)).toBe(DEFAULT_ROOM_ID)
  })
})
