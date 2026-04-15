import { FormEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, MessageSquareMore, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GoogleLoginButton } from '../auth/GoogleLoginButton'
import type { AuthSession } from '../auth/useGoogleAuth'
import { DEFAULT_ROOM_ID } from '../chat/roomId'

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

export function HomeScreen({
  error,
  googleClientId,
  googleReady,
  initialRoomId,
  loading,
  onContinueAsGuest,
  onEnterRoom,
  onLogin,
  onLoginWithLocalAccount,
  onLogout,
  onSignupWithLocalAccount,
  pendingRoomId,
  session,
}: {
  error: string | null
  googleClientId: string
  googleReady: boolean
  initialRoomId: string
  loading: boolean
  onContinueAsGuest(displayName?: string): Promise<void>
  onEnterRoom(roomId: string): void
  onLogin(credential: string): Promise<void>
  onLoginWithLocalAccount(input: { email: string; password: string }): Promise<void>
  onLogout(): Promise<void>
  onSignupWithLocalAccount(input: { displayName?: string; email: string; password: string }): Promise<void>
  pendingRoomId: string | null
  session: AuthSession | null
}) {
  const [roomDraft, setRoomDraft] = useState(initialRoomId)
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)

  useEffect(() => {
    setRoomDraft(initialRoomId)
  }, [initialRoomId])

  const submitRoomDialog = (event: FormEvent) => {
    event.preventDefault()
    onEnterRoom(roomDraft)
    setRoomDialogOpen(false)
  }

  const openRoomDialog = () => {
    setRoomDraft(initialRoomId)
    setRoomDialogOpen(true)
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="space-y-2 px-1">
          <h1 className="text-2xl font-semibold tracking-[-0.06em]">Talk</h1>
          <p className="text-sm text-muted-foreground">Real-time translated chat</p>
          <p className="text-sm text-muted-foreground">Join first, then choose the room id right before chat opens.</p>
        </div>

        <section className="space-y-3 rounded-[1.5rem] border border-border bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-base font-medium">How to use Talk</h2>
            <p className="text-sm text-muted-foreground">
              Talk lets everyone stay in the same room while each person reads messages in their own target language.
            </p>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1.</span> Continue as a guest or sign in with a local account.
            </li>
            <li>
              <span className="font-medium text-foreground">2.</span> Choose a room id to create or join a shared conversation.
            </li>
            <li>
              <span className="font-medium text-foreground">3.</span> Inside the room, pick your target language and start chatting.
            </li>
          </ol>
        </section>

        {session ? (
          <section className="space-y-4 rounded-[1.5rem] border border-border bg-card p-4">
            <div className="space-y-2">
              <p className="text-base font-medium">Signed in as {session.user.display_name}</p>
              <p className="text-sm text-muted-foreground">
                You&apos;re authenticated. Pick the room you want to join when you&apos;re ready.
              </p>
              {pendingRoomId ? (
                <p className="text-sm text-muted-foreground">We&apos;ll take you to {pendingRoomId} as soon as chat opens.</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="w-full" onClick={openRoomDialog} size="lg" type="button">
                <MessageSquareMore className="size-4" />
                Join room
              </Button>
              <Button className="w-full" onClick={() => void onLogout()} size="lg" type="button" variant="outline">
                Logout
              </Button>
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        ) : (
          <>
            {pendingRoomId ? (
              <section className="rounded-[1.5rem] border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Sign in or continue as a guest to enter <span className="font-medium text-foreground">{pendingRoomId}</span>.
                </p>
              </section>
            ) : null}
            <GoogleLoginButton
              clientId={googleClientId}
              error={error}
              googleReady={googleReady}
              loading={loading}
              onContinueAsGuest={onContinueAsGuest}
              onLogin={onLogin}
              onLoginWithLocalAccount={onLoginWithLocalAccount}
              onSignupWithLocalAccount={onSignupWithLocalAccount}
              session={session}
            />
          </>
        )}
      </section>

      <RoomJoinDialog
        onClose={() => setRoomDialogOpen(false)}
        onRoomDraftChange={setRoomDraft}
        onSubmit={submitRoomDialog}
        open={Boolean(session) && roomDialogOpen}
        roomDraft={roomDraft}
      />
    </>
  )
}
