import { FormEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, DoorOpen, LogOut, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AuthAccessPanel } from '../auth/AuthAccessPanel'
import type { AuthSession } from '../auth/useGoogleAuth'
import { DEFAULT_ROOM_ID } from '../chat/roomId'

function RoomEntryPanel({
  heading,
  helperText,
  roomDraft,
  submitLabel,
  onRoomDraftChange,
  onSubmit,
}: {
  heading: string
  helperText: string
  roomDraft: string
  submitLabel: string
  onRoomDraftChange(value: string): void
  onSubmit(event: FormEvent): void
}) {
  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          <DoorOpen className="size-3.5" />
          Room entry
        </p>
        <h2 className="text-lg font-semibold tracking-[-0.04em]">{heading}</h2>
        <p className="text-sm text-muted-foreground">{helperText}</p>
      </div>

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="room-id">
            Room id
          </label>
          <input
            autoComplete="off"
            className="h-12 w-full rounded-[1rem] border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
            id="room-id"
            onChange={(event) => onRoomDraftChange(event.target.value)}
            placeholder={DEFAULT_ROOM_ID}
            value={roomDraft}
          />
          <p className="text-xs text-muted-foreground">Leave it blank to use {DEFAULT_ROOM_ID}.</p>
        </div>
        <Button className="w-full self-end sm:w-auto sm:min-w-40" size="lg" type="submit">
          <ArrowRightLeft className="size-4" />
          {submitLabel}
        </Button>
      </form>
    </section>
  )
}

export function HomeScreen({
  error,
  initialRoomId,
  loading,
  onContinueAsGuest,
  onEnterRoom,
  onLoginWithLocalAccount,
  onLogout,
  onSignupWithLocalAccount,
  pendingRoomId,
  session,
}: {
  error: string | null
  initialRoomId: string
  loading: boolean
  onContinueAsGuest(displayName?: string): Promise<void>
  onEnterRoom(roomId: string): void
  onLoginWithLocalAccount(input: { email: string; password: string }): Promise<void>
  onLogout(): Promise<void>
  onSignupWithLocalAccount(input: { displayName?: string; email: string; password: string }): Promise<void>
  pendingRoomId: string | null
  session: AuthSession | null
}) {
  const [roomDraft, setRoomDraft] = useState(initialRoomId)

  useEffect(() => {
    setRoomDraft(initialRoomId)
  }, [initialRoomId])

  const submitRoomEntry = (event: FormEvent) => {
    event.preventDefault()
    onEnterRoom(roomDraft)
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <section className="rounded-[1.9rem] border border-border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-7">
        <div className="max-w-2xl space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            Real-time translated conversation
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.07em] sm:text-4xl">Talk</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Step into the same room, send your message once, and let everyone else read it in the language they chose.
          </p>
        </div>
      </section>

      {session ? (
        <>
          <section className="grid gap-4 rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Signed in as {session.user.display_name}</p>
              <p className="text-sm text-muted-foreground">
                Pick a room and start the conversation. Everyone will see each message in the view that matches their language.
              </p>
              {pendingRoomId ? (
                <p className="text-sm text-muted-foreground">
                  We already saved <span className="font-medium text-foreground">{pendingRoomId}</span> for you.
                </p>
              ) : null}
            </div>
            <Button className="w-full sm:w-auto" onClick={() => void onLogout()} size="lg" type="button" variant="outline">
              <LogOut className="size-4" />
              Logout
            </Button>
          </section>

          <RoomEntryPanel
            heading={pendingRoomId ? `Open ${pendingRoomId}` : 'Choose a room'}
            helperText={
              pendingRoomId
                ? 'We saved the room you asked for. You can open it directly or adjust it before you continue.'
                : 'Pick the shared room name you want to enter. You can switch rooms again from inside chat.'
            }
            onRoomDraftChange={setRoomDraft}
            onSubmit={submitRoomEntry}
            roomDraft={roomDraft}
            submitLabel={pendingRoomId ? 'Open room' : 'Enter room'}
          />
        </>
      ) : (
        <>
          {pendingRoomId ? (
            <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-6">
              <p className="text-sm text-muted-foreground">
                Sign in or continue as a guest to enter <span className="font-medium text-foreground">{pendingRoomId}</span>.
              </p>
            </section>
          ) : null}
          <AuthAccessPanel
            error={error}
            loading={loading}
            onContinueAsGuest={onContinueAsGuest}
            onLoginWithLocalAccount={onLoginWithLocalAccount}
            onSignupWithLocalAccount={onSignupWithLocalAccount}
          />
        </>
      )}
    </section>
  )
}
