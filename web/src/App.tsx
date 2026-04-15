import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { useGoogleAuth } from './features/auth/useGoogleAuth'
import { ChatRoomRoute } from './features/chat/ChatRoomRoute'
import { buildChatPath, DEFAULT_ROOM_ID, getLegacyRoomIdFromSearch, normalizeRoomId } from './features/chat/roomId'
import { HomeScreen } from './features/home/HomeScreen'

function LoadingScreen() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <section className="rounded-[1.5rem] border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground" role="status">
          Restoring your Talk session…
        </p>
      </section>
    </section>
  )
}

export function App() {
  const auth = useGoogleAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [intendedRoomId, setIntendedRoomId] = useState<string | null>(null)

  useEffect(() => {
    if (!auth.sessionHydrated || location.pathname !== '/') {
      return
    }

    const legacyRoomId = getLegacyRoomIdFromSearch(location.search)
    if (!legacyRoomId) {
      return
    }

    if (auth.session) {
      navigate(buildChatPath(legacyRoomId), { replace: true })
      return
    }

    setIntendedRoomId((current) => current ?? legacyRoomId)
  }, [auth.session, auth.sessionHydrated, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!auth.sessionHydrated || !auth.session || !intendedRoomId || location.pathname !== '/') {
      return
    }

    const nextRoomId = normalizeRoomId(intendedRoomId)
    setIntendedRoomId(null)
    navigate(buildChatPath(nextRoomId), { replace: true })
  }, [auth.session, auth.sessionHydrated, intendedRoomId, location.pathname, navigate])

  const goToRoomFromHome = (roomId: string) => {
    setIntendedRoomId(null)
    navigate(buildChatPath(roomId))
  }

  const requireAuthForRoom = (roomId: string) => {
    setIntendedRoomId(normalizeRoomId(roomId))
  }

  const leaveChat = async () => {
    if (auth.session?.user.auth_provider === 'guest') {
      await auth.logout()
    }
    setIntendedRoomId(null)
    navigate('/', { replace: true })
  }

  const logoutToHome = async () => {
    await auth.logout()
    setIntendedRoomId(null)
    navigate('/', { replace: true })
  }

  const initialRoomId = intendedRoomId ?? DEFAULT_ROOM_ID

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-h-screen flex-col">
          <main className="flex flex-1 items-center justify-center py-4 sm:py-6">
            {!auth.sessionHydrated ? (
              <LoadingScreen />
            ) : (
              <Routes>
                <Route
                  element={
                    <HomeScreen
                      error={auth.error}
                      googleClientId={auth.googleClientId}
                      googleReady={auth.googleReady}
                      initialRoomId={initialRoomId}
                      loading={auth.loading}
                      onContinueAsGuest={auth.continueAsGuest}
                      onEnterRoom={goToRoomFromHome}
                      onLogin={auth.loginWithCredential}
                      onLoginWithLocalAccount={auth.loginWithLocalAccount}
                      onLogout={logoutToHome}
                      onSignupWithLocalAccount={auth.signupWithLocalAccount}
                      pendingRoomId={intendedRoomId}
                      session={auth.session}
                    />
                  }
                  path="/"
                />
                <Route
                  element={
                    <ChatRoomRoute
                      apiBaseUrl={auth.apiBaseUrl}
                      onLeave={leaveChat}
                      onRequireAuth={requireAuthForRoom}
                      session={auth.session}
                    />
                  }
                  path="/chat/:roomId"
                />
                <Route element={<Navigate replace to="/" />} path="*" />
              </Routes>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
