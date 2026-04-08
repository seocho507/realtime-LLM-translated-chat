import { FormEvent, useEffect, useRef, useState } from 'react'

import type { AuthSession } from './useGoogleAuth'

interface GoogleLoginButtonProps {
  clientId: string
  loading: boolean
  session: AuthSession | null
  error: string | null
  googleReady: boolean
  onLogin(credential: string): Promise<void>
}

export function GoogleLoginButton({
  clientId,
  loading,
  session,
  error,
  googleReady,
  onLogin,
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
    return <p>Signed in as {session.user.email}</p>
  }

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
      <h2>Sign in with Google OAuth2</h2>
      <p>Use the Google button when GIS is available, or paste a credential for local/manual testing.</p>
      <div ref={containerRef} data-testid="google-button-container" />
      <form onSubmit={(event) => void handleSubmit(event)} style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="credential">Manual Google credential</label>
        <textarea
          id="credential"
          value={manualCredential}
          onChange={(event) => setManualCredential(event.target.value)}
          rows={4}
        />
        <button disabled={loading} type="submit">
          {loading ? 'Signing in…' : 'Use credential'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {!clientId ? <p>Set `VITE_GOOGLE_CLIENT_ID` to enable the Google rendered button.</p> : null}
    </section>
  )
}
