import { useEffect, useMemo, useState } from 'react'

export interface AuthSession {
  token: string
  user: {
    session_id: string
    user_id: string
    google_sub: string
    email: string
    expires_at: number
  }
}

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
}

export function useGoogleAuth() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), [])

  useEffect(() => {
    let cancelled = false
    if (!googleClientId) {
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`)
    if (existing) {
      setGoogleReady(Boolean(window.google?.accounts?.id))
      return
    }
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!cancelled) {
        setGoogleReady(Boolean(window.google?.accounts?.id))
      }
    }
    script.onerror = () => {
      if (!cancelled) {
        setError('Failed to load Google Identity Services script.')
      }
    }
    document.head.appendChild(script)
    return () => {
      cancelled = true
    }
  }, [googleClientId])

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/session`, { credentials: 'include' })
        if (!response.ok) {
          return
        }
        const user = await response.json()
        setSession({ token: '', user })
      } catch {
        // best-effort session restore only
      }
    }
    void run()
  }, [apiBaseUrl])

  const loginWithCredential = async (credential: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential }),
      })
      if (!response.ok) {
        throw new Error('Google login failed.')
      }
      const payload = (await response.json()) as AuthSession
      setSession(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return {
    apiBaseUrl,
    error,
    googleClientId,
    googleReady,
    loading,
    loginWithCredential,
    session,
  }
}
