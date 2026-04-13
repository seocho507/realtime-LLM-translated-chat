import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatRoom } from './ChatRoom'

const { sendMessage } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}))

vi.mock('./useChatSocket', () => ({
  useChatSocket: () => ({
    connected: true,
    messages: [],
    sendMessage,
  }),
}))

describe('ChatRoom', () => {
  beforeEach(() => {
    sendMessage.mockReset()
  })

  it('submits the draft when Enter is pressed', async () => {
    const user = userEvent.setup()

    render(
      <ChatRoom
        apiBaseUrl="http://localhost:8080"
        conversationId="room-1"
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

    await user.clear(screen.getByLabelText(/room id/i))
    await user.type(screen.getByLabelText(/room id/i), 'Team Alpha')
    await user.click(screen.getByRole('button', { name: /join room/i }))

    expect(onRoomChange).toHaveBeenCalledWith('team-alpha')
  })
})
