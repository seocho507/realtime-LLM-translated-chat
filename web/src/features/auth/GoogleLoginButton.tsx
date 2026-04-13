import { FormEvent, useState } from 'react'
import { ArrowRightLeft, UserPlus, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AuthSession } from './useGoogleAuth'

type LocalAuthMode = 'signup' | 'signin'

interface GoogleLoginButtonProps {
  clientId: string
  loading: boolean
  session: AuthSession | null
  error: string | null
  googleReady: boolean
  onLogin(credential: string): Promise<void>
  onContinueAsGuest(displayName?: string): Promise<void>
  onSignupWithLocalAccount(input: { displayName?: string; email: string; password: string }): Promise<void>
  onLoginWithLocalAccount(input: { email: string; password: string }): Promise<void>
}

export function GoogleLoginButton({
  clientId: _clientId,
  loading,
  session,
  error,
  googleReady: _googleReady,
  onLogin: _onLogin,
  onContinueAsGuest,
  onSignupWithLocalAccount,
  onLoginWithLocalAccount,
}: GoogleLoginButtonProps) {
  const [localMode, setLocalMode] = useState<LocalAuthMode>('signup')
  const [guestDisplayName, setGuestDisplayName] = useState('')
  const [localDisplayName, setLocalDisplayName] = useState('')
  const [localEmail, setLocalEmail] = useState('')
  const [localPassword, setLocalPassword] = useState('')

  const handleLocalSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (localMode === 'signup') {
      await onSignupWithLocalAccount({
        displayName: localDisplayName.trim() || undefined,
        email: localEmail.trim(),
        password: localPassword,
      })
      return
    }
    await onLoginWithLocalAccount({
      email: localEmail.trim(),
      password: localPassword,
    })
  }

  if (session) {
    return <p>Signed in as {session.user.display_name}</p>
  }

  return (
    <section className="space-y-4 rounded-[1.5rem] border border-border bg-card p-4">
      <div className="space-y-2">
        <h2 className="text-base font-medium">Guest</h2>
        <label className="block text-sm font-medium" htmlFor="guest-display-name">
          Nickname
        </label>
        <input
          id="guest-display-name"
          className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
          maxLength={40}
          onChange={(event) => setGuestDisplayName(event.target.value)}
          placeholder="Optional nickname"
          value={guestDisplayName}
        />
        <Button
          className="w-full"
          disabled={loading}
          onClick={() => void onContinueAsGuest(guestDisplayName.trim() || undefined)}
          size="lg"
          type="button"
        >
          <UserRound className="size-4" />
          {loading ? 'Entering...' : 'Continue as guest'}
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="grid grid-cols-2 rounded-full border border-border bg-background p-1">
          <button
            aria-pressed={localMode === 'signup'}
            className={`rounded-full px-3 py-2 text-sm transition ${
              localMode === 'signup' ? 'bg-foreground text-background' : 'text-muted-foreground'
            }`}
            onClick={() => setLocalMode('signup')}
            type="button"
          >
            Create account
          </button>
          <button
            aria-pressed={localMode === 'signin'}
            className={`rounded-full px-3 py-2 text-sm transition ${
              localMode === 'signin' ? 'bg-foreground text-background' : 'text-muted-foreground'
            }`}
            onClick={() => setLocalMode('signin')}
            type="button"
          >
            Sign in
          </button>
        </div>

        <form className="space-y-3" onSubmit={(event) => void handleLocalSubmit(event)}>
            {localMode === 'signup' ? (
              <>
                <label className="block text-sm font-medium" htmlFor="signup-display-name">
                  Display name
                </label>
                <input
                  id="signup-display-name"
                  className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
                  onChange={(event) => setLocalDisplayName(event.target.value)}
                  placeholder="Optional"
                  value={localDisplayName}
                />
              </>
            ) : null}
            <label className="block text-sm font-medium" htmlFor="local-email">
              Email
            </label>
            <input
              id="local-email"
              className="h-12 w-full rounded-[1.1rem] border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
              onChange={(event) => setLocalEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={localEmail}
            />
            <label className="block text-sm font-medium" htmlFor="local-password">
              Password
            </label>
            <input
              id="local-password"
              className="h-12 w-full rounded-[1.1rem] border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
              minLength={8}
              onChange={(event) => setLocalPassword(event.target.value)}
              placeholder={localMode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
              type="password"
              value={localPassword}
            />
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {localMode === 'signup'
                  ? 'Create a reusable account without changing the existing auth payload shape.'
                  : 'Use the same identity shape as Google sign-in, but with your local email and password.'}
              </p>
              <Button className="w-full" disabled={loading} type="submit">
                {localMode === 'signup' ? <UserPlus className="size-4" /> : <ArrowRightLeft className="size-4" />}
                {loading ? (localMode === 'signup' ? 'Creating...' : 'Signing in...') : localMode === 'signup' ? 'Create account' : 'Sign in'}
              </Button>
            </div>
        </form>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
    </section>
  )
}
