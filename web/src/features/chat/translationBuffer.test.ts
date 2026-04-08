import { describe, expect, it, vi } from 'vitest'

import { createTranslationBuffer } from './translationBuffer'

describe('translationBuffer', () => {
  it('coalesces deltas and flushes them on a timer', () => {
    vi.useFakeTimers()
    const chunks: Array<{ id: string; text: string }> = []
    const buffer = createTranslationBuffer(40, (chunk) => chunks.push(chunk))

    buffer.add({ id: 'm1', text: 'Hello ' })
    buffer.add({ id: 'm1', text: 'world' })
    vi.advanceTimersByTime(41)

    expect(chunks).toEqual([{ id: 'm1', text: 'Hello world' }])
    buffer.stop()
    vi.useRealTimers()
  })
})
