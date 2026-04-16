import '@testing-library/jest-dom/vitest'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatRoom } from './ChatRoom'

const { sendMessage, connectedState, mockedMessages } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  connectedState: { value: true },
  mockedMessages: [] as Array<{
    id: string
    senderDisplayName: string
    original: string
    translated: string
    translationState: 'streaming' | 'ready' | 'fallback'
    src: string
    dst: string
  }>,
}))

vi.mock('./useChatSocket', () => ({
  useChatSocket: () => ({
    connected: connectedState.value,
    messages: mockedMessages,
    sendMessage,
  }),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} type="button">
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode; value: string }) => <div>{children}</div>,
}))

describe('ChatRoom', () => {
  beforeEach(() => {
    sendMessage.mockReset()
    connectedState.value = true
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

    const input = screen.getByPlaceholderText(/write your message naturally/i)
    await user.type(input, 'hello{enter}')

    expect(sendMessage).toHaveBeenCalledWith('hello')
    expect((screen.getByPlaceholderText(/write your message naturally/i) as HTMLTextAreaElement).value).toBe('')
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

    await user.type(screen.getByPlaceholderText(/write your message naturally/i), 'hello')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(sendMessage).toHaveBeenCalledWith('hello')
    expect((screen.getByPlaceholderText(/write your message naturally/i) as HTMLTextAreaElement).value).toBe('')
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

    await user.click(screen.getByRole('button', { name: /change room/i }))
    await user.clear(screen.getByLabelText(/room id/i))
    await user.type(screen.getByLabelText(/room id/i), 'Team Alpha')
    await user.click(screen.getByRole('button', { name: /open room/i }))

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

  it('keeps the language selector and send button in the stacked mobile action layout', () => {
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

    expect(screen.getByTestId('composer-actions').className).toContain('flex-col')
    expect(screen.getByTestId('composer-actions').className).not.toContain('sm:flex-row')
    expect(screen.getByTestId('composer-form').className).toContain('gap-4')
  })

  it('reserves a larger default message viewport while keeping the shell layout stable', () => {
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

    expect(screen.getByTestId('chat-shell').className).toContain('grid-rows-[auto_auto_minmax(0,1fr)_auto]')
    expect(screen.getByTestId('message-viewport').className).toContain('min-h-[20rem]')
    expect(screen.getByTestId('message-viewport').className).not.toContain('sm:min-h-[23rem]')
    expect(screen.getByTestId('composer-shell').className).toContain('pt-3')
    expect(screen.getByTestId('composer-shell').className).toContain('pb-[max(0.375rem,env(safe-area-inset-bottom))]')
    expect(screen.getByTestId('message-card').className).toContain('p-3')
    expect(screen.getByPlaceholderText(/write your message naturally/i).className).toContain('min-h-[4.5rem]')
    expect(screen.getByPlaceholderText(/write your message naturally/i).className).toContain('px-2')
  })

  it('includes Chinese in the target language options', () => {
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

    expect(screen.getByText('Chinese')).toBeInTheDocument()
  })

  it('shows a neutral not-ready shell state when the room is not ready yet', () => {
    connectedState.value = false

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

    expect(screen.getByTestId('room-connection-state')).toHaveTextContent(/not ready yet/i)
    expect(screen.getAllByText(/this room is not ready yet/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/switch rooms, or try again once the live connection is available/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /room not ready yet/i })).toBeDisabled()
  })

  it('renders sender names and scrolls to the latest message', () => {
    mockedMessages.push({
      id: 'm1',
      senderDisplayName: 'Guest User',
      original: 'hello',
      translated: '[en] hello',
      translationState: 'ready',
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
