import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import type { AuthSession } from './features/auth/useGoogleAuth'

const mockUseGoogleAuth = vi.fn()

vi.mock('./features/auth/useGoogleAuth', () => ({
  useGoogleAuth: () => mockUseGoogleAuth(),
}))

vi.mock('./features/auth/GoogleLoginButton', () => ({
  GoogleLoginButton: () => <div>Auth controls</div>,
}))

vi.mock('./features/chat/ChatRoom', () => ({
  ChatRoom: ({ conversationId }: { conversationId: string }) => <div>Chat room: {conversationId}</div>,
}))

function buildSession(displayName = 'Guest Floyd'): AuthSession {
  return {
    user: {
      session_id: 'session-1',
      user_id: 'user-1',
      auth_provider: 'guest',
      display_name: displayName,
      google_sub: null,
      email: null,
      expires_at: 9999999999,
    },
  }
}

function buildAuthState(overrides: Partial<ReturnType<typeof mockUseGoogleAuth>> = {}) {
  return {
    apiBaseUrl: 'http://localhost:8080',
    continueAsGuest: vi.fn().mockResolvedValue(undefined),
    error: null,
    googleClientId: '',
    googleReady: false,
    loading: false,
    loginWithCredential: vi.fn().mockResolvedValue(undefined),
    loginWithLocalAccount: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    session: null,
    sessionHydrated: true,
    signupWithLocalAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('App', () => {
  beforeEach(() => {
    mockUseGoogleAuth.mockReset()
    window.history.replaceState({}, '', '/')
  })

  it('keeps room selection out of the initial landing screen', () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState())

    render(<App />)

    expect(screen.getByText('Auth controls')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^room id$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/join first, then choose the room id/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how to use talk/i })).toBeInTheDocument()
    expect(screen.getByText(/continue as a guest or sign in/i)).toBeInTheDocument()
    expect(screen.getByText(/pick your target language and start chatting/i)).toBeInTheDocument()
  })

  it('opens the room dialog after a new session is created and enters chat with the submitted room', async () => {
    const user = userEvent.setup()
    const anonymousState = buildAuthState()
    const signedInState = buildAuthState({ session: buildSession() })

    mockUseGoogleAuth.mockReturnValue(anonymousState)
    const { rerender } = render(<App />)

    mockUseGoogleAuth.mockReturnValue(signedInState)
    rerender(<App />)

    expect(screen.getByRole('dialog', { name: /join a room/i })).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/^room id$/i))
    await user.type(screen.getByLabelText(/^room id$/i), 'Team Alpha')
    await user.click(screen.getByRole('button', { name: /enter chat/i }))

    expect(screen.getByText('Chat room: team-alpha')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /join a room/i })).not.toBeInTheDocument()
  })

  it('restores directly into chat when an existing session is already hydrated', () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState({ session: buildSession('Restored User') }))

    render(<App />)

    expect(screen.getByText('Chat room: demo-room')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /join a room/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /go to home/i })).not.toBeInTheDocument()
  })
})
