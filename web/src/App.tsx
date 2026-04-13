import { FormEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, ArrowUpRight, MessageSquareMore, Orbit, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
    <div className="relative min-h-screen overflow-hidden bg-[#f4f7f6] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(73,180,166,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(11,18,22,0.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
        <div className="flex min-h-screen flex-col rounded-[2rem] border border-white/70 bg-white/75 shadow-[0_35px_120px_-60px_rgba(15,23,42,0.4)] backdrop-blur-xl">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-white/80 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
          <div className="space-y-1">
            <button
              aria-label="Go to home"
              className="flex items-center gap-3 rounded-full text-left outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/60"
              onClick={() => void resetToInitial()}
              type="button"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-foreground text-background sm:size-10">
                <Orbit className="size-4" />
              </span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground sm:text-[11px]">Talk</p>
                <h1 className="text-base font-semibold tracking-[-0.04em] sm:text-lg">Real-time translated chat</h1>
              </div>
            </button>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <Badge className="sm:hidden" variant="outline">
              Live translate
            </Badge>
            <div className="hidden items-center gap-3 sm:flex">
              <Badge variant="outline">Original-first delivery</Badge>
              <Badge variant="secondary">Streaming translation</Badge>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
          {auth.session && !showLanding ? (
            <ChatRoom
              session={auth.session}
              apiBaseUrl={auth.apiBaseUrl}
              conversationId={roomId}
              onRoomChange={updateRoomId}
            />
          ) : (
            <section className="grid gap-5 lg:min-h-[calc(100svh-12rem)] lg:grid-cols-[minmax(0,1.05fr)_25rem] lg:items-stretch lg:gap-8">
              <div className="order-2 flex flex-col justify-between gap-5 lg:order-1 lg:gap-8">
                <div className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,248,247,0.88))] p-5 shadow-sm animate-in fade-in-0 slide-in-from-bottom-6 duration-700 sm:rounded-[2rem] sm:p-7">
                  <div className="max-w-3xl space-y-4 sm:space-y-6">
                  <Badge variant="outline" className="rounded-full px-4 py-1 text-[10px] tracking-[0.24em] sm:text-[11px]">
                    Minimal multilingual workspace
                  </Badge>
                  <div className="space-y-4 sm:space-y-5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Current translation surface</p>
                    <h2 className="max-w-4xl text-4xl font-semibold leading-none tracking-[-0.08em] text-balance sm:text-5xl lg:text-7xl">
                      Quiet chat UI.
                      <br />
                      Fast language handoff.
                    </h2>
                    <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7 lg:text-lg">
                      Start with guest access on mobile, or switch to Google or a saved account when you need a persistent identity.
                    </p>
                  </div>
                  <div className="grid gap-3 pt-2 sm:grid-cols-3">
                    <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Step 1</p>
                      <p className="mt-2 text-sm font-medium">Pick a room</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Step 2</p>
                      <p className="mt-2 text-sm font-medium">Enter instantly</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Step 3</p>
                      <p className="mt-2 text-sm font-medium">Watch the stream settle</p>
                    </div>
                  </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-border/60 bg-white/70 p-4 space-y-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Mood</p>
                    <p className="max-w-sm text-sm leading-6 text-foreground/80">
                      Warm neutrals, compact spacing, and one cool accent so the conversation stays louder than the chrome.
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-border/60 bg-white/70 p-4 space-y-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Flow</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/80 sm:gap-3">
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        Guest entry
                      </span>
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                      <span>Send</span>
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                      <span>Translation stream</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 space-y-4 animate-in fade-in-0 slide-in-from-bottom-8 duration-700 lg:order-2">
                <form className="rounded-[1.6rem] border border-border/70 bg-white/85 p-4 shadow-sm sm:rounded-[1.8rem]" onSubmit={submitLandingRoom}>
                  <div className="space-y-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Room id</p>
                      <p className="mt-2 text-sm leading-6 text-foreground/80">
                        Choose the room you want to enter next. Default is `{DEFAULT_ROOM_ID}`.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
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
                    <p className="text-xs leading-5 text-muted-foreground">
                      This updates the room target. You enter it when you continue into chat.
                    </p>
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
              </div>
            </section>
          )}
        </main>
        </div>
      </div>
    </div>
  )
}
