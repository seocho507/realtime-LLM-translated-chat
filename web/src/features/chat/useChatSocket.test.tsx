import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatSocket } from './useChatSocket'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  sent: unknown[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  receive(payload: Record<string, string>) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>)
  }
}

function Harness({ conversationId, targetLang }: { conversationId: string; targetLang: string }) {
  const { connected, messages } = useChatSocket({
    apiBaseUrl: 'http://localhost:8080',
    conversationId,
    targetLang,
  })

  return (
    <>
      <div data-testid="connected">{String(connected)}</div>
      <pre data-testid="messages">{JSON.stringify(messages)}</pre>
    </>
  )
}

const originalWebSocket = globalThis.WebSocket

describe('useChatSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.WebSocket = originalWebSocket
  })

  it('applies language changes only to later messages', async () => {
    const view = render(<Harness conversationId="room-1" targetLang="en" />)
    const socket = MockWebSocket.instances[0]

    act(() => {
      socket.open()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true')
    })

    act(() => {
      socket.receive({
        t: 'msg_start',
        id: 'm1',
        original: 'hello',
        src: 'en',
        dst: 'en',
        status: 'translating',
        sender_display_name: 'Guest User',
      })
      socket.receive({ t: 'msg_final', id: 'm1', text: '[en] hello', dst: 'en' })
    })

    await waitFor(() => {
      const messages = screen.getByTestId('messages').textContent ?? ''
      expect(messages).toContain('"id":"m1"')
      expect(messages).toContain('"senderDisplayName":"Guest User"')
      expect(messages).toContain('"translated":"[en] hello"')
      expect(messages).toContain('"dst":"en"')
    })

    view.rerender(<Harness conversationId="room-1" targetLang="ko" />)

    await waitFor(() => {
      expect(socket.sent).toContainEqual({ type: 'set_target_lang', target_lang: 'ko' })
    })

    expect(screen.getByTestId('messages').textContent).toContain('"translated":"[en] hello"')
    expect(screen.getByTestId('messages').textContent).toContain('"dst":"en"')

    act(() => {
      socket.receive({
        t: 'msg_start',
        id: 'm2',
        original: 'world',
        src: 'en',
        dst: 'ko',
        status: 'translating',
        sender_display_name: 'Guest User',
      })
      socket.receive({ t: 'msg_final', id: 'm2', text: '[ko] world', dst: 'ko' })
    })

    await waitFor(() => {
      const messages = screen.getByTestId('messages').textContent ?? ''
      expect(messages).toContain('"id":"m1"')
      expect(messages).toContain('"translated":"[en] hello"')
      expect(messages).toContain('"id":"m2"')
      expect(messages).toContain('"translated":"[ko] world"')
    })
  })

  it('opens a new socket and clears messages when the room changes', async () => {
    const view = render(<Harness conversationId="room-1" targetLang="en" />)
    const firstSocket = MockWebSocket.instances[0]

    act(() => {
      firstSocket.open()
      firstSocket.receive({
        t: 'msg_start',
        id: 'm1',
        original: 'hello',
        src: 'en',
        dst: 'en',
        status: 'translating',
        sender_display_name: 'Guest User',
      })
      firstSocket.receive({ t: 'msg_final', id: 'm1', text: '[en] hello', dst: 'en' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toContain('"id":"m1"')
    })

    view.rerender(<Harness conversationId="team-alpha" targetLang="en" />)

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2)
      expect(MockWebSocket.instances[1].url).toContain('/ws/chat/team-alpha')
      expect(screen.getByTestId('messages').textContent).toBe('[]')
    })
  })

  it('falls back to the original text when translation errors', async () => {
    render(<Harness conversationId="room-1" targetLang="en" />)
    const socket = MockWebSocket.instances[0]

    act(() => {
      socket.open()
      socket.receive({
        t: 'msg_start',
        id: 'm1',
        original: 'hello',
        src: 'en',
        dst: 'en',
        status: 'translating',
        sender_display_name: 'Guest User',
      })
      socket.receive({ t: 'msg_error', id: 'm1', dst: 'en', code: 'translation_failed' })
    })

    await waitFor(() => {
      const messages = screen.getByTestId('messages').textContent ?? ''
      expect(messages).toContain('"translated":"hello"')
      expect(messages).toContain('"status":"original"')
    })
  })
})
