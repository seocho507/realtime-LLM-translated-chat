import { FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, MessageSquareMore, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GoogleLoginButton } from './features/auth/GoogleLoginButton'
import { useGoogleAuth } from './features/auth/useGoogleAuth'
import { ChatRoom } from './features/chat/ChatRoom'
import { DEFAULT_ROOM_ID, getRoomIdFromLocation, normalizeRoomId, syncRoomIdToUrl } from './features/chat/roomId'

function RoomJoinDialog({
  open,
  roomDraft,
  onClose,
  onRoomDraftChange,
  onSubmit,
}: {
  open: boolean
  roomDraft: string
  onClose(): void
  onRoomDraftChange(value: string): void
  onSubmit(event: FormEvent): void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div
        aria-labelledby="join-room-dialog-title"
        aria-modal="true"
        className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Ready to join</p>
            <h2 className="text-xl font-semibold tracking-[-0.05em]" id="join-room-dialog-title">
              Join a room
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter the room id now and we&apos;ll connect you straight to chat.
            </p>
          </div>
          <button
            aria-label="Close room dialog"
            className="rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="join-room-id">
              Room id
            </label>
            <input
              autoFocus
              className="h-12 w-full rounded-[1.1rem] border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
              id="join-room-id"
              onChange={(event) => onRoomDraftChange(event.target.value)}
              placeholder="Enter room id"
              value={roomDraft}
            />
            <p className="text-xs text-muted-foreground">Leave it blank to use {DEFAULT_ROOM_ID}.</p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              Later
            </Button>
            <Button type="submit">
              <ArrowRightLeft className="size-4" />
              Enter chat
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function App() {
  const auth = useGoogleAuth()
  const [roomId, setRoomId] = useState(() => getRoomIdFromLocation(window.location.search))
  const [roomDraft, setRoomDraft] = useState(roomId)
  const [showLanding, setShowLanding] = useState(true)
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const initializedSessionRef = useRef(false)
  const previousSessionIdRef = useRef<string | null>(null)

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
    if (!auth.sessionHydrated) {
      return
    }

    const nextSessionId = auth.session?.user.session_id ?? null

    if (!initializedSessionRef.current) {
      initializedSessionRef.current = true
      previousSessionIdRef.current = nextSessionId
      if (nextSessionId) {
        setShowLanding(false)
      }
      return
    }

    if (!nextSessionId) {
      previousSessionIdRef.current = null
      setRoomDialogOpen(false)
      setShowLanding(true)
      return
    }

    if (nextSessionId !== previousSessionIdRef.current) {
      previousSessionIdRef.current = nextSessionId
      setRoomDraft(roomId)
      setRoomDialogOpen(true)
      setShowLanding(true)
    }
  }, [auth.session, auth.sessionHydrated, roomId])

  const updateRoomId = (nextRoomId: string) => {
    const normalizedRoomId = normalizeRoomId(nextRoomId)
    setRoomId(normalizedRoomId)
    setRoomDraft(normalizedRoomId)
    syncRoomIdToUrl(normalizedRoomId)
  }

  const submitRoomDialog = (event: FormEvent) => {
    event.preventDefault()
    updateRoomId(roomDraft)
    setRoomDialogOpen(false)
    setShowLanding(false)
  }

  const openRoomDialog = () => {
    setRoomDraft(roomId)
    setRoomDialogOpen(true)
  }

  const resetToInitial = async () => {
    if (auth.session?.user.auth_provider === 'guest') {
      await auth.logout()
    }
    updateRoomId(DEFAULT_ROOM_ID)
    setRoomDialogOpen(false)
    setShowLanding(true)
  }

  const logoutToInitial = async () => {
    await auth.logout()
    updateRoomId(DEFAULT_ROOM_ID)
    setRoomDialogOpen(false)
    setShowLanding(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-h-screen flex-col">
          <main className="flex flex-1 items-center justify-center py-4 sm:py-6">
            {auth.session && !showLanding ? (
              <ChatRoom
                apiBaseUrl={auth.apiBaseUrl}
                conversationId={roomId}
                onLeave={() => void resetToInitial()}
                onRoomChange={updateRoomId}
                session={auth.session}
              />
            ) : (
              <section className="mx-auto flex w-full max-w-md flex-col gap-4">
                <div className="space-y-2 px-1">
                  <h1 className="text-2xl font-semibold tracking-[-0.06em]">Talk</h1>
                  <p className="text-sm text-muted-foreground">Real-time translated chat</p>
                  <p className="text-sm text-muted-foreground">
                    Join first, then choose the room id right before chat opens.
                  </p>
                </div>

                {auth.session ? (
                  <section className="space-y-4 rounded-[1.5rem] border border-border bg-card p-4">
                    <div className="space-y-2">
                      <p className="text-base font-medium">Signed in as {auth.session.user.display_name}</p>
                      <p className="text-sm text-muted-foreground">
                        You&apos;re authenticated. Pick the room you want to join when you&apos;re ready.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button className="w-full" onClick={openRoomDialog} size="lg" type="button">
                        <MessageSquareMore className="size-4" />
                        Join room
                      </Button>
                      <Button className="w-full" onClick={() => void logoutToInitial()} size="lg" type="button" variant="outline">
                        Logout
                      </Button>
                    </div>
                    {auth.error ? (
                      <p className="text-sm text-destructive" role="alert">
                        {auth.error}
                      </p>
                    ) : null}
                  </section>
                ) : (
                  <GoogleLoginButton
                    clientId={auth.googleClientId}
                    error={auth.error}
                    googleReady={auth.googleReady}
                    loading={auth.loading}
                    onContinueAsGuest={auth.continueAsGuest}
                    onLogin={auth.loginWithCredential}
                    onLoginWithLocalAccount={auth.loginWithLocalAccount}
                    onSignupWithLocalAccount={auth.signupWithLocalAccount}
                    session={auth.session}
                  />
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      <RoomJoinDialog
        onClose={() => setRoomDialogOpen(false)}
        onRoomDraftChange={setRoomDraft}
        onSubmit={submitRoomDialog}
        open={Boolean(auth.session) && roomDialogOpen}
        roomDraft={roomDraft}
      />
    </div>
  )
}
