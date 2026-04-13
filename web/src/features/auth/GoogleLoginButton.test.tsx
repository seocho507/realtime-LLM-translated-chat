import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GoogleLoginButton } from './GoogleLoginButton'

function buildProps() {
  return {
    clientId: '',
    loading: false,
    session: null,
    error: null,
    googleReady: false,
    onLogin: vi.fn().mockResolvedValue(undefined),
    onContinueAsGuest: vi.fn().mockResolvedValue(undefined),
    onSignupWithLocalAccount: vi.fn().mockResolvedValue(undefined),
    onLoginWithLocalAccount: vi.fn().mockResolvedValue(undefined),
  }
}

describe('GoogleLoginButton', () => {
  it('continues as guest when requested', async () => {
    const user = userEvent.setup()
    const props = buildProps()

    render(<GoogleLoginButton {...props} />)

    await user.type(screen.getByLabelText(/nickname/i), 'Guest Floyd')
    await user.click(screen.getByRole('button', { name: /continue as guest/i }))

    expect(props.onContinueAsGuest).toHaveBeenCalledWith('Guest Floyd')
  })

  it('submits a local sign-up payload when requested', async () => {
    const user = userEvent.setup()
    const props = buildProps()

    render(<GoogleLoginButton {...props} />)

    await user.type(screen.getByLabelText(/^display name$/i), 'Local User')
    await user.type(screen.getByLabelText(/^email$/i), 'local@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getAllByRole('button', { name: /^create account$/i })[1])

    expect(props.onSignupWithLocalAccount).toHaveBeenCalledWith({
      displayName: 'Local User',
      email: 'local@example.com',
      password: 'password123',
    })
  })

  it('submits a local sign-in payload after switching modes', async () => {
    const user = userEvent.setup()
    const props = buildProps()

    render(<GoogleLoginButton {...props} />)

    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await user.type(screen.getByLabelText(/^email$/i), 'local@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getAllByRole('button', { name: /^sign in$/i })[1])

    expect(props.onLoginWithLocalAccount).toHaveBeenCalledWith({
      email: 'local@example.com',
      password: 'password123',
    })
  })
})
