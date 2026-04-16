import { useEffect, useMemo, useState } from 'react'

export interface AuthSession {
  user: {
    session_id: string
    user_id: string
    auth_provider: 'google' | 'guest' | 'local'
    display_name: string
    google_sub: string | null
    email: string | null
    expires_at: number
  }
}

function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  return window.location.origin
}

export function useGoogleAuth() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/session`, { credentials: 'include' })
        if (!response.ok || cancelled) {
          return
        }
        const user = await response.json()
        if (!cancelled) {
          setSession({ user })
        }
      } catch {
        // best-effort session restore only
      } finally {
        if (!cancelled) {
          setSessionHydrated(true)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  const authenticate = async (path: string, body: object, fallbackMessage: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        let detail = fallbackMessage
        try {
          const payload = (await response.json()) as { detail?: string }
          detail = payload.detail ?? fallbackMessage
        } catch {
          // keep fallback message
        }
        throw new Error(detail)
      }
      const payload = (await response.json()) as AuthSession
      setSession(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage)
    } finally {
      setLoading(false)
    }
  }

  const continueAsGuest = async (displayName?: string) => {
    await authenticate('/api/auth/guest', { display_name: displayName }, 'Guest entry failed.')
  }

  const signupWithLocalAccount = async ({
    displayName,
    email,
    password,
  }: {
    displayName?: string
    email: string
    password: string
  }) => {
    await authenticate('/api/auth/signup', { display_name: displayName, email, password }, 'Sign up failed.')
  }

  const loginWithLocalAccount = async ({ email, password }: { email: string; password: string }) => {
    await authenticate('/api/auth/login', { email, password }, 'Sign in failed.')
  }

  const logout = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok && response.status !== 204) {
        throw new Error('Sign out failed.')
      }
      setSession(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed.')
    } finally {
      setLoading(false)
    }
  }

  return {
    apiBaseUrl,
    continueAsGuest,
    error,
    loading,
    loginWithLocalAccount,
    logout,
    session,
    sessionHydrated,
    signupWithLocalAccount,
  }
}
