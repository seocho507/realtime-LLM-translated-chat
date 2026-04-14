import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatRoom } from './ChatRoom'

const { sendMessage, mockedMessages } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  mockedMessages: [] as Array<{
    id: string
    senderDisplayName: string
    original: string
    translated: string
    status: string
    src: string
    dst: string
  }>,
}))

vi.mock('./useChatSocket', () => ({
  useChatSocket: () => ({
    connected: true,
    messages: mockedMessages,
    sendMessage,
  }),
}))

describe('ChatRoom', () => {
  beforeEach(() => {
    sendMessage.mockReset()
    mockedMessages.length = 0
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      value: 640,
    })
    HTMLElement.prototype.scrollTo = vi.fn()
    HTMLElement.prototype.scrollIntoView = vi.fn()
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
    HTMLElement.prototype.releasePointerCapture = vi.fn()
    HTMLElement.prototype.setPointerCapture = vi.fn()
  })

  it('submits the draft when Enter is pressed', async () => {
    const user = userEvent.setup()

    render(
      <ChatRoom
        apiBaseUrl="http://localhost:8080"
        conversationId="room-1"
        onLeave={vi.fn()}
        onRoomChange={vi.fn()}
        session={{
          user: {
            session_id: 's1',
            user_id: 'u1',
            auth_provider: 'guest',
            display_name: 'Guest User',
            google_sub: null,
            email: null,
            expires_at: 9999999999,
          },
        }}
      />,
    )

    const input = screen.getByPlaceholderText(/write naturally/i)
    await user.type(input, 'hello{enter}')

    expect(sendMessage).toHaveBeenCalledWith('hello')
    expect((screen.getByPlaceholderText(/write naturally/i) as HTMLTextAreaElement).value).toBe('')
  })

  it('submits the draft when the send button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ChatRoom
        apiBaseUrl="http://localhost:8080"
        conversationId="room-1"
        onLeave={vi.fn()}
        onRoomChange={vi.fn()}
        session={{
          user: {
            session_id: 's1',
            user_id: 'u1',
            auth_provider: 'guest',
            display_name: 'Guest User',
            google_sub: null,
            email: null,
            expires_at: 9999999999,
          },
        }}
      />,
    )

    await user.type(screen.getByPlaceholderText(/write naturally/i), 'hello')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(sendMessage).toHaveBeenCalledWith('hello')
    expect((screen.getByPlaceholderText(/write naturally/i) as HTMLTextAreaElement).value).toBe('')
  })

  it('joins a different room id when requested', async () => {
    const user = userEvent.setup()
    const onRoomChange = vi.fn()

    render(
      <ChatRoom
        apiBaseUrl="http://localhost:8080"
        conversationId="room-1"
        onLeave={vi.fn()}
        onRoomChange={onRoomChange}
        session={{
          user: {
            session_id: 's1',
            user_id: 'u1',
            auth_provider: 'guest',
            display_name: 'Guest User',
            google_sub: null,
            email: null,
            expires_at: 9999999999,
          },
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /open room menu/i }))
    await user.clear(screen.getByLabelText(/room id/i))
    await user.type(screen.getByLabelText(/room id/i), 'Team Alpha')
    await user.click(screen.getByRole('button', { name: /join room/i }))

    expect(onRoomChange).toHaveBeenCalledWith('team-alpha')
  })

  it('leaves chat from the header action', async () => {
    const user = userEvent.setup()
    const onLeave = vi.fn()

    render(
      <ChatRoom
        apiBaseUrl="http://localhost:8080"
        conversationId="room-1"
        onLeave={onLeave}
        onRoomChange={vi.fn()}
        session={{
          user: {
            session_id: 's1',
            user_id: 'u1',
            auth_provider: 'guest',
            display_name: 'Guest User',
            google_sub: null,
            email: null,
            expires_at: 9999999999,
          },
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /leave/i }))

    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('includes Chinese in the target language options', async () => {
    render(
      <ChatRoom
        apiBaseUrl="http://localhost:8080"
        conversationId="room-1"
        onLeave={vi.fn()}
        onRoomChange={vi.fn()}
        session={{
          user: {
            session_id: 's1',
            user_id: 'u1',
            auth_provider: 'guest',
            display_name: 'Guest User',
            google_sub: null,
            email: null,
            expires_at: 9999999999,
          },
        }}
      />,
    )

    const trigger = screen.getByLabelText(/target language/i)
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    expect((await screen.findAllByText('Chinese')).length).toBeGreaterThan(0)
  })

  it('renders sender names and scrolls to the latest message', () => {
    mockedMessages.push({
      id: 'm1',
      senderDisplayName: 'Guest User',
      original: 'hello',
      translated: '[en] hello',
      status: 'translated',
      src: 'en',
      dst: 'en',
    })

    render(
      <ChatRoom
        apiBaseUrl="http://localhost:8080"
        conversationId="room-1"
        onLeave={vi.fn()}
        onRoomChange={vi.fn()}
        session={{
          user: {
            session_id: 's1',
            user_id: 'u1',
            auth_provider: 'guest',
            display_name: 'Guest User',
            google_sub: null,
            email: null,
            expires_at: 9999999999,
          },
        }}
      />,
    )

    expect(screen.getAllByText('Guest User').length).toBeGreaterThan(0)
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled()
  })
})
