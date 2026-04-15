import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom'
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
  ChatRoom: ({
    conversationId,
    onLeave,
    onRoomChange,
  }: {
    conversationId: string
    onLeave: () => void
    onRoomChange: (roomId: string) => void
  }) => (
    <div>
      <div>Chat room: {conversationId}</div>
      <button onClick={() => onRoomChange('Team Beta')} type="button">
        Switch room
      </button>
      <button onClick={onLeave} type="button">
        Leave chat
      </button>
    </div>
  ),
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

function RouteDiagnostics() {
  const location = useLocation()
  const navigationType = useNavigationType()

  return (
    <div>
      <div data-testid="location-path">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
      <div data-testid="navigation-type">{navigationType}</div>
    </div>
  )
}

function renderApp(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <RouteDiagnostics />
    </MemoryRouter>,
  )
}

describe('App', () => {
  beforeEach(() => {
    mockUseGoogleAuth.mockReset()
  })

  it('keeps room selection out of the anonymous home screen', () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState())

    renderApp('/')

    expect(screen.getByText('Auth controls')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^room id$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/join first, then choose the room id/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how to use talk/i })).toBeInTheDocument()
    expect(screen.getByText(/continue as a guest or sign in/i)).toBeInTheDocument()
    expect(screen.getByText(/pick your target language and start chatting/i)).toBeInTheDocument()
    expect(screen.getByTestId('location-path')).toHaveTextContent('/')
  })

  it('keeps restored sessions on signed-in home instead of auto-entering chat', () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState({ session: buildSession('Restored User') }))

    renderApp('/')

    expect(screen.getByText('Signed in as Restored User')).toBeInTheDocument()
    expect(screen.queryByText(/chat room:/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /join a room/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('location-path')).toHaveTextContent('/')
  })

  it('shows a loading shell without redirecting before hydration completes', () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState({ sessionHydrated: false }))

    renderApp('/chat/team-alpha')

    expect(screen.getByRole('status')).toHaveTextContent(/restoring your talk session/i)
    expect(screen.getByTestId('location-path')).toHaveTextContent('/chat/team-alpha')
    expect(screen.queryByText(/chat room:/i)).not.toBeInTheDocument()
  })

  it('renders chat directly for authenticated chat routes', () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState({ session: buildSession('Room User') }))

    renderApp('/chat/team-alpha')

    expect(screen.getByText('Chat room: team-alpha')).toBeInTheDocument()
    expect(screen.getByTestId('location-path')).toHaveTextContent('/chat/team-alpha')
  })

  it('redirects anonymous chat requests to home and returns after auth succeeds', async () => {
    const anonymousState = buildAuthState()
    const signedInState = buildAuthState({ session: buildSession('Recovered User') })

    mockUseGoogleAuth.mockReturnValue(anonymousState)
    const view = renderApp('/chat/Team Alpha')

    await waitFor(() => {
      expect(screen.getByTestId('location-path')).toHaveTextContent('/')
    })
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
    expect(screen.getByText(/sign in or continue as a guest to enter/i)).toHaveTextContent('team-alpha')

    mockUseGoogleAuth.mockReturnValue(signedInState)
    view.rerender(
      <MemoryRouter initialEntries={['/chat/Team Alpha']}>
        <App />
        <RouteDiagnostics />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Chat room: team-alpha')).toBeInTheDocument()
    })
    expect(screen.getByTestId('location-path')).toHaveTextContent('/chat/team-alpha')
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
  })

  it('canonicalizes legacy signed-in room links into chat routes', async () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState({ session: buildSession('Legacy User') }))

    renderApp('/?room=Team%20Alpha')

    await waitFor(() => {
      expect(screen.getByText('Chat room: team-alpha')).toBeInTheDocument()
    })
    expect(screen.getByTestId('location-path')).toHaveTextContent('/chat/team-alpha')
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
  })

  it('preserves anonymous legacy room intent on home', async () => {
    mockUseGoogleAuth.mockReturnValue(buildAuthState())

    renderApp('/?room=Team%20Alpha')

    await waitFor(() => {
      expect(screen.getByText(/sign in or continue as a guest to enter/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/team-alpha/)).toBeInTheDocument()
    expect(screen.getByTestId('location-path')).toHaveTextContent('/')
    expect(screen.getByTestId('location-search')).toHaveTextContent('?room=Team%20Alpha')
  })

  it('joins from home, switches rooms with replace, and leaves back home with replace', async () => {
    const user = userEvent.setup()
    mockUseGoogleAuth.mockReturnValue(buildAuthState({ session: buildSession('Planner Floyd') }))

    renderApp('/')

    await user.click(screen.getByRole('button', { name: /join room/i }))
    await user.clear(screen.getByLabelText(/^room id$/i))
    await user.type(screen.getByLabelText(/^room id$/i), 'Team Alpha')
    await user.click(screen.getByRole('button', { name: /enter chat/i }))

    await waitFor(() => {
      expect(screen.getByText('Chat room: team-alpha')).toBeInTheDocument()
    })
    expect(screen.getByTestId('location-path')).toHaveTextContent('/chat/team-alpha')

    await user.click(screen.getByRole('button', { name: /switch room/i }))
    await waitFor(() => {
      expect(screen.getByText('Chat room: team-beta')).toBeInTheDocument()
    })
    expect(screen.getByTestId('location-path')).toHaveTextContent('/chat/team-beta')
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')

    await user.click(screen.getByRole('button', { name: /leave chat/i }))
    await waitFor(() => {
      expect(screen.getByText('Signed in as Planner Floyd')).toBeInTheDocument()
    })
    expect(screen.getByTestId('location-path')).toHaveTextContent('/')
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
  })
})
