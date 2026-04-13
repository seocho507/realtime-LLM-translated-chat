import { FormEvent, useEffect, useRef, useState } from 'react'
import { KeyRound, Orbit, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import type { AuthSession } from './useGoogleAuth'

interface GoogleLoginButtonProps {
  clientId: string
  loading: boolean
  session: AuthSession | null
  error: string | null
  googleReady: boolean
  onLogin(credential: string): Promise<void>
  onContinueAsGuest(): Promise<void>
}

export function GoogleLoginButton({
  clientId,
  loading,
  session,
  error,
  googleReady,
  onLogin,
  onContinueAsGuest,
}: GoogleLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [manualCredential, setManualCredential] = useState('')

  useEffect(() => {
    if (!clientId || !googleReady || !containerRef.current || !window.google?.accounts?.id) {
      return
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        void onLogin(credential)
      },
    })
    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      text: 'continue_with',
      size: 'large',
      width: 320,
    })
  }, [clientId, googleReady, onLogin])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const credential = manualCredential.trim()
    if (!credential) {
      return
    }
    await onLogin(credential)
  }

  if (session) {
    return <p>Signed in as {session.user.display_name}</p>
  }

  return (
    <section className="rounded-[2rem] border border-border/70 bg-white/80 p-6 shadow-[0_24px_80px_-40px_rgba(16,24,40,0.35)] backdrop-blur-xl sm:p-7">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] tracking-[0.24em]">
              Access
            </Badge>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-[-0.06em]">Join the room</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Google sign-in stays available, but guest entry is the fastest path into the live translation surface.
              </p>
            </div>
          </div>
          <span className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground">
            <Orbit className="size-5" />
          </span>
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Guest access</p>
                <p className="text-xs text-muted-foreground">No account required</p>
              </div>
            </div>
            <Button disabled={loading} onClick={() => void onContinueAsGuest()} size="lg" type="button">
              {loading ? 'Entering...' : 'Continue as guest'}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <KeyRound className="size-4" />
            </span>
            <div>
              <p className="font-medium">Google access</p>
              <p className="text-xs text-muted-foreground">Use GIS button or a local test credential</p>
            </div>
          </div>
          <div
            className="min-h-12 rounded-[1.25rem] border border-dashed border-border bg-white px-3 py-2"
            ref={containerRef}
            data-testid="google-button-container"
          />
        </div>

        <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <label className="text-sm font-medium" htmlFor="credential">
            Manual Google credential
          </label>
          <Textarea
            id="credential"
            value={manualCredential}
            onChange={(event) => setManualCredential(event.target.value)}
            placeholder="Paste an ID token for local testing"
            rows={4}
          />
          <Button className="w-full sm:w-auto" disabled={loading} type="submit" variant="secondary">
            {loading ? 'Signing in...' : 'Use credential'}
          </Button>
        </form>

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {!clientId ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> to enable the rendered Google button.
          </p>
        ) : null}
      </div>
    </section>
  )
}
