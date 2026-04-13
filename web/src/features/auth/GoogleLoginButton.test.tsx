import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GoogleLoginButton } from './GoogleLoginButton'

describe('GoogleLoginButton', () => {
  it('submits a manual credential when requested', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onContinueAsGuest = vi.fn().mockResolvedValue(undefined)

    render(
      <GoogleLoginButton
        clientId=""
        loading={false}
        session={null}
        error={null}
        googleReady={false}
        onLogin={onLogin}
        onContinueAsGuest={onContinueAsGuest}
      />,
    )

    await user.type(screen.getByLabelText(/manual google credential/i), 'credential-token')
    await user.click(screen.getByRole('button', { name: /use credential/i }))

    expect(onLogin).toHaveBeenCalledWith('credential-token')
  })

  it('continues as guest when requested', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onContinueAsGuest = vi.fn().mockResolvedValue(undefined)

    render(
      <GoogleLoginButton
        clientId=""
        loading={false}
        session={null}
        error={null}
        googleReady={false}
        onLogin={onLogin}
        onContinueAsGuest={onContinueAsGuest}
      />,
    )

    await user.click(screen.getByRole('button', { name: /continue as guest/i }))

    expect(onContinueAsGuest).toHaveBeenCalledTimes(1)
  })
})
