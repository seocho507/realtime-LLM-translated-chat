import { FormEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, ArrowUpRight, Orbit, Sparkles } from 'lucide-react'

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

  useEffect(() => {
    const handlePopState = () => {
      const nextRoomId = getRoomIdFromLocation(window.location.search)
      setRoomId(nextRoomId)
      setRoomDraft(nextRoomId)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(73,180,166,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(11,18,22,0.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-foreground text-background">
                <Orbit className="size-4" />
              </span>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Talk</p>
                <h1 className="text-lg font-semibold tracking-[-0.04em]">Real-time translated chat</h1>
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <Badge variant="outline">Original-first delivery</Badge>
            <Badge variant="secondary">Streaming translation</Badge>
          </div>
        </header>

        <main className="flex-1 py-8 sm:py-10">
          {auth.session ? (
            <ChatRoom
              session={auth.session}
              apiBaseUrl={auth.apiBaseUrl}
              conversationId={roomId}
              onRoomChange={updateRoomId}
            />
          ) : (
            <section className="grid min-h-[calc(100svh-10rem)] gap-10 lg:grid-cols-[minmax(0,1.1fr)_26rem] lg:items-end">
              <div className="flex flex-col justify-between gap-10">
                <div className="max-w-3xl space-y-6 animate-in fade-in-0 slide-in-from-bottom-6 duration-700">
                  <Badge variant="outline" className="rounded-full px-4 py-1 text-[11px] tracking-[0.24em]">
                    Minimal multilingual workspace
                  </Badge>
                  <div className="space-y-5">
                    <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">Current translation surface</p>
                    <h2 className="max-w-4xl text-5xl font-semibold leading-none tracking-[-0.08em] text-balance sm:text-6xl lg:text-7xl">
                      Quiet chat UI.
                      <br />
                      Fast language handoff.
                    </h2>
                    <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                      Enter as guest or connect Google, then send one message and watch the translated stream settle in place.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 border-t border-border/70 pt-6 md:grid-cols-[1fr_auto_1fr] md:items-start">
                  <div className="space-y-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Mood</p>
                    <p className="max-w-sm text-sm leading-6 text-foreground/80">
                      Warm neutrals, tight spacing, and one cool accent so the message stream stays louder than the chrome.
                    </p>
                  </div>
                  <Separator orientation="vertical" className="hidden h-16 md:block" />
                  <div className="space-y-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Flow</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/80">
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

              <div className="animate-in fade-in-0 slide-in-from-bottom-8 space-y-4 duration-700 lg:pl-6">
                <form className="rounded-[1.7rem] border border-border/70 bg-white/80 p-4 shadow-sm" onSubmit={submitLandingRoom}>
                  <div className="space-y-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Room id</p>
                      <p className="mt-2 text-sm leading-6 text-foreground/80">
                        Share the same room id to enter one conversation. Default is `{DEFAULT_ROOM_ID}`.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
                        onChange={(event) => setRoomDraft(event.target.value)}
                        placeholder="Enter room id"
                        value={roomDraft}
                      />
                      <Button size="lg" type="submit" variant="outline">
                        <ArrowRightLeft className="size-4" />
                        Set room
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
                />
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
