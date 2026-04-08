import { GoogleLoginButton } from './features/auth/GoogleLoginButton'
import { useGoogleAuth } from './features/auth/useGoogleAuth'
import { ChatRoom } from './features/chat/ChatRoom'

export function App() {
  const auth = useGoogleAuth()

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Real-Time LLM Translated Chat</h1>
      <p>Original-first delivery with streamed translation overlays.</p>
      {auth.session ? (
        <ChatRoom session={auth.session} apiBaseUrl={auth.apiBaseUrl} />
      ) : (
        <GoogleLoginButton
          clientId={auth.googleClientId}
          loading={auth.loading}
          session={auth.session}
          error={auth.error}
          googleReady={auth.googleReady}
          onLogin={auth.loginWithCredential}
        />
      )}
    </main>
  )
}
