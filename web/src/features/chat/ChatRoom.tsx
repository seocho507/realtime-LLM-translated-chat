import { FormEvent, KeyboardEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, Menu, SendHorizonal, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { AuthSession } from '../auth/useGoogleAuth'
import { normalizeRoomId } from './roomId'
import { TranslationBubble } from './TranslationBubble'
import { useChatSocket } from './useChatSocket'

export function ChatRoom({
  session,
  apiBaseUrl,
  conversationId,
  onRoomChange,
}: {
  session: AuthSession
  apiBaseUrl: string
  conversationId: string
  onRoomChange: (roomId: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [targetLang, setTargetLang] = useState('en')
  const [roomDraft, setRoomDraft] = useState(conversationId)
  const [menuOpen, setMenuOpen] = useState(false)
  const { connected, messages, sendMessage } = useChatSocket({
    apiBaseUrl,
    conversationId,
    targetLang,
  })
  const canSend = connected && draft.trim().length > 0

  useEffect(() => {
    setRoomDraft(conversationId)
  }, [conversationId])

  const submitDraft = () => {
    const text = draft.trim()
    if (!text || !connected) {
      return false
    }
    sendMessage(text)
    setDraft('')
    return true
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    submitDraft()
  }

  const joinRoom = () => {
    const nextRoomId = normalizeRoomId(roomDraft)
    setRoomDraft(nextRoomId)
    if (nextRoomId !== conversationId) {
      onRoomChange(nextRoomId)
    }
    setMenuOpen(false)
  }

  const submitRoomChange = (event: FormEvent) => {
    event.preventDefault()
    joinRoom()
  }

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    submitDraft()
  }

  return (
    <section className="mx-auto w-full max-w-[28rem] lg:max-w-[26rem]">
      <div className="grid min-h-[76svh] w-full grid-rows-[auto_1fr_auto] overflow-hidden rounded-[1.8rem] border border-border bg-card sm:rounded-[2rem] lg:min-h-0 lg:aspect-[390/844]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="mt-1 truncate text-base font-semibold tracking-[-0.04em] sm:text-lg">{conversationId}</h3>
            <p className="text-xs text-muted-foreground">{session.user.display_name}</p>
          </div>
          <div className="relative">
            <Button
              aria-expanded={menuOpen}
              aria-label="Open room menu"
              className="h-10 w-10 rounded-full p-0"
              onClick={() => setMenuOpen((current) => !current)}
              size="icon"
              type="button"
              variant="outline"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 z-20 w-64 rounded-[1.2rem] border border-border/70 bg-white/96 p-3 shadow-xl backdrop-blur-xl">
                <form className="flex flex-col gap-3" onSubmit={submitRoomChange}>
                  <div className="min-w-0">
                    <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground" htmlFor="room-id">
                      Room id
                    </label>
                    <input
                      className="mt-2 h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
                      id="room-id"
                      onChange={(event) => setRoomDraft(event.target.value)}
                      placeholder="Enter room id"
                      value={roomDraft}
                    />
                  </div>
                  <Button className="w-full" size="lg" type="submit" variant="outline">
                    <ArrowRightLeft className="size-4" />
                    Join room
                  </Button>
                </form>
              </div>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-56 items-center justify-center rounded-[1.25rem] border border-dashed border-border bg-background px-5 text-center sm:min-h-64 sm:rounded-[1.5rem] sm:px-6">
              <div className="max-w-sm space-y-3">
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((message) => (
                <TranslationBubble key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/70 bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="grid gap-4">
            <form className="grid gap-4" onSubmit={submit}>
              <div className="rounded-[1.4rem] border border-border bg-white p-3">
                <Textarea
                  className="min-h-28 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  id="message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder="Write naturally. The translation stream will follow."
                  rows={4}
                />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor="target-language">
                    Target language
                  </label>
                  <Select onValueChange={setTargetLang} value={targetLang}>
                    <SelectTrigger aria-label="Target language" className="w-full sm:w-44" id="target-language">
                      <SelectValue placeholder="Target language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ko">Korean</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full rounded-[1.2rem] sm:w-auto sm:min-w-32 sm:self-end" disabled={!canSend} size="lg" type="submit">
                  <SendHorizonal className="size-4" />
                  Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
