import { FormEvent, useState } from 'react'
import { ArrowRightLeft, Sparkles, UserPlus, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'

type LocalAuthMode = 'signup' | 'signin'

interface AuthAccessPanelProps {
  loading: boolean
  error: string | null
  onContinueAsGuest(displayName?: string): Promise<void>
  onSignupWithLocalAccount(input: { displayName?: string; email: string; password: string }): Promise<void>
  onLoginWithLocalAccount(input: { email: string; password: string }): Promise<void>
}

export function AuthAccessPanel({
  loading,
  error,
  onContinueAsGuest,
  onSignupWithLocalAccount,
  onLoginWithLocalAccount,
}: AuthAccessPanelProps) {
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

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5" />
          Join in the way that fits you
        </p>
        <h2 className="text-lg font-semibold tracking-[-0.04em]">Start this conversation</h2>
        <p className="text-sm text-muted-foreground">
          Use guest access to jump in quickly, or create an account if you want a reusable identity for later.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.94fr_1.06fr]">
        <section className="rounded-[1.4rem] border border-border bg-background p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Quick guest access</p>
            <p className="text-sm text-muted-foreground">
              Perfect for trying a room right away. Add a nickname if you want one.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium" htmlFor="guest-display-name">
              Nickname
            </label>
            <input
              id="guest-display-name"
              className="h-11 w-full rounded-[1rem] border border-border bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
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
              {loading ? 'Joining…' : 'Continue as guest'}
            </Button>
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-border bg-background p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Reusable account</p>
            <p className="text-sm text-muted-foreground">
              Keep the same identity for future rooms with local email sign-in.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-full border border-border bg-card p-1">
            <button
              aria-pressed={localMode === 'signup'}
              className={`rounded-full px-3 py-2 text-sm transition ${
                localMode === 'signup' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setLocalMode('signup')}
              type="button"
            >
              Create account
            </button>
            <button
              aria-pressed={localMode === 'signin'}
              className={`rounded-full px-3 py-2 text-sm transition ${
                localMode === 'signin' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setLocalMode('signin')}
              type="button"
            >
              Sign in
            </button>
          </div>

          <form className="mt-4 space-y-3" onSubmit={(event) => void handleLocalSubmit(event)}>
            {localMode === 'signup' ? (
              <>
                <label className="block text-sm font-medium" htmlFor="signup-display-name">
                  Display name
                </label>
                <input
                  id="signup-display-name"
                  className="h-11 w-full rounded-[1rem] border border-border bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
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
              className="h-12 w-full rounded-[1rem] border border-border bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
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
              className="h-12 w-full rounded-[1rem] border border-border bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
              minLength={8}
              onChange={(event) => setLocalPassword(event.target.value)}
              placeholder={localMode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
              type="password"
              value={localPassword}
            />

            <p className="text-xs leading-5 text-muted-foreground">
              {localMode === 'signup'
                ? 'Create an account once, then come back to any room with the same profile.'
                : 'Use the account you already created for Talk.'}
            </p>

            <Button className="w-full" disabled={loading} type="submit">
              {localMode === 'signup' ? <UserPlus className="size-4" /> : <ArrowRightLeft className="size-4" />}
              {loading ? (localMode === 'signup' ? 'Creating account…' : 'Signing in…') : localMode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        </section>
      </div>

      {error ? (
        <p className="rounded-[1rem] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
