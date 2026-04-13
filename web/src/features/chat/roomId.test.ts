import { describe, expect, it } from 'vitest'

import { DEFAULT_ROOM_ID, getRoomIdFromLocation, normalizeRoomId } from './roomId'

describe('roomId helpers', () => {
  it('normalizes a room id into a url-safe slug', () => {
    expect(normalizeRoomId(' Team Alpha / 01 ')).toBe('team-alpha-01')
  })

  it('falls back to the default room id when the value is empty', () => {
    expect(normalizeRoomId('   ')).toBe(DEFAULT_ROOM_ID)
  })

  it('reads the room id from the current location search', () => {
    expect(getRoomIdFromLocation('?room=Project%20One')).toBe('project-one')
  })
})
