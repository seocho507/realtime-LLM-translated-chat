import { FormEvent, useState } from 'react'
import { ArrowRightLeft, Mail, Orbit, UserPlus, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
    <section className="overflow-hidden rounded-[1.9rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,247,0.9))] shadow-[0_24px_80px_-40px_rgba(16,24,40,0.35)] backdrop-blur-xl">
      <div className="space-y-5 p-4 sm:p-6 sm:space-y-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] tracking-[0.24em]">
              Access
            </Badge>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-[-0.06em] sm:text-2xl">Join the room</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Start as a guest in one click, or use a saved account path when you want a persistent identity.
              </p>
            </div>
          </div>
          <span className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground">
            <Orbit className="size-5" />
          </span>
        </div>

        <div className="rounded-[1.5rem] border border-primary/20 bg-primary/7 p-4 shadow-sm">
          <div className="space-y-4">
            <div className="w-full space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Guest access</p>
                  <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px] tracking-[0.18em]">
                    Recommended
                  </Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Fastest route into the chat. No setup, no password, same room flow.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="guest-display-name">
                  Nickname
                </label>
                <input
                  id="guest-display-name"
                  className="mt-2 h-12 w-full rounded-[1.1rem] border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
                  maxLength={40}
                  onChange={(event) => setGuestDisplayName(event.target.value)}
                  placeholder="Optional nickname"
                  value={guestDisplayName}
                />
              </div>
            </div>
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
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/90 p-4 shadow-sm">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Mail className="size-4" />
                </span>
                <div>
                  <p className="font-medium">Local account</p>
                  <p className="text-xs text-muted-foreground">Password sign-up that stays compatible with the existing Google session entity</p>
                </div>
              </div>
            </div>
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
          </div>

          <form className="space-y-3 rounded-[1.25rem] border border-border/70 bg-white/90 p-4" onSubmit={(event) => void handleLocalSubmit(event)}>
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
        </div>

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
    </section>
  )
}
