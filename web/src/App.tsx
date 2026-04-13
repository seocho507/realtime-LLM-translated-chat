import { FormEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, MessageSquareMore } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GoogleLoginButton } from './features/auth/GoogleLoginButton'
import { useGoogleAuth } from './features/auth/useGoogleAuth'
import { ChatRoom } from './features/chat/ChatRoom'
import { DEFAULT_ROOM_ID, getRoomIdFromLocation, normalizeRoomId, syncRoomIdToUrl } from './features/chat/roomId'

export function App() {
  const auth = useGoogleAuth()
  const [roomId, setRoomId] = useState(() => getRoomIdFromLocation(window.location.search))
  const [roomDraft, setRoomDraft] = useState(roomId)
  const [showLanding, setShowLanding] = useState(true)

  useEffect(() => {
    const handlePopState = () => {
      const nextRoomId = getRoomIdFromLocation(window.location.search)
      setRoomId(nextRoomId)
      setRoomDraft(nextRoomId)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (auth.session) {
      setShowLanding(false)
    }
  }, [auth.session])

  const updateRoomId = (nextRoomId: string) => {
    const normalizedRoomId = normalizeRoomId(nextRoomId)
    setRoomId(normalizedRoomId)
    setRoomDraft(normalizedRoomId)
    syncRoomIdToUrl(normalizedRoomId)
  }

  const submitLandingRoom = (event: FormEvent) => {
    event.preventDefault()
    updateRoomId(roomDraft)
  }

  const resetToInitial = async () => {
    if (auth.session?.user.auth_provider === 'guest') {
      await auth.logout()
    }
    updateRoomId(DEFAULT_ROOM_ID)
    setShowLanding(true)
  }

  const openChat = () => {
    setShowLanding(false)
  }

  const logoutToInitial = async () => {
    await auth.logout()
    updateRoomId(DEFAULT_ROOM_ID)
    setShowLanding(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 px-1 py-2 sm:py-3">
          <div>
            <button
              aria-label="Go to home"
              className="rounded-full outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/60"
              onClick={() => void resetToInitial()}
              type="button"
            >
              <span className="block size-9 rounded-full bg-primary sm:size-10" />
            </button>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-4 sm:py-6">
          {auth.session && !showLanding ? (
            <ChatRoom
              session={auth.session}
              apiBaseUrl={auth.apiBaseUrl}
              conversationId={roomId}
              onRoomChange={updateRoomId}
            />
          ) : (
            <section className="mx-auto flex w-full max-w-md flex-col gap-4">
              <div className="space-y-1 px-1">
                <h1 className="text-2xl font-semibold tracking-[-0.06em]">Talk</h1>
                <p className="text-sm text-muted-foreground">Real-time translated chat</p>
              </div>
              <form className="rounded-[1.5rem] border border-border bg-card p-4" onSubmit={submitLandingRoom}>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium" htmlFor="home-room-id">Room</label>
                    <div className="flex flex-col gap-3">
                      <input
                        id="home-room-id"
                        className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
                        onChange={(event) => setRoomDraft(event.target.value)}
                        placeholder="Enter room id"
                        value={roomDraft}
                      />
                      <Button className="w-full sm:w-auto" size="lg" type="submit" variant="outline">
                        <ArrowRightLeft className="size-4" />
                        Choose room
                      </Button>
                    </div>
                  </div>
                </form>
              <GoogleLoginButton
                clientId={auth.googleClientId}
                loading={auth.loading}
                session={auth.session}
                error={auth.error}
                googleReady={auth.googleReady}
                onLogin={auth.loginWithCredential}
                onContinueAsGuest={auth.continueAsGuest}
                onSignupWithLocalAccount={auth.signupWithLocalAccount}
                onLoginWithLocalAccount={auth.loginWithLocalAccount}
              />
              {auth.session ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button className="w-full" onClick={openChat} size="lg" type="button">
                    <MessageSquareMore className="size-4" />
                    Open chat
                  </Button>
                  <Button className="w-full" onClick={() => void logoutToInitial()} size="lg" type="button" variant="outline">
                    Logout
                  </Button>
                </div>
              ) : null}
            </section>
          )}
        </main>
        </div>
      </div>
    </div>
  )
}
