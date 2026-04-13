import { FormEvent, KeyboardEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, ArrowUpRight, Languages, SendHorizonal, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
    <section className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-6 border-b border-border/70 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
        <div className="space-y-3">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] tracking-[0.22em]">
            Workspace
          </Badge>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-[-0.06em]">Chat</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Original text lands first, then the translation stream resolves in place.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-border/70 bg-white/70 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Session</p>
            <p className="mt-2 text-sm font-medium">{session.user.display_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{session.user.auth_provider}</p>
          </div>

          <div className="rounded-[1.4rem] border border-border/70 bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Socket</p>
                <p className="mt-2 text-sm font-medium">{connected ? 'Connected' : 'Connecting'}</p>
              </div>
              <Badge variant={connected ? 'default' : 'secondary'}>{connected ? 'Live' : 'Pending'}</Badge>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Flow</p>
          <div className="space-y-2 text-sm text-foreground/80">
            <p className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Source message appears immediately
            </p>
            <p className="flex items-center gap-2">
              <ArrowUpRight className="size-4 text-primary" />
              Translation deltas accumulate live
            </p>
            <p className="flex items-center gap-2">
              <Languages className="size-4 text-primary" />
              Final text locks with provider metadata
            </p>
          </div>
        </div>
      </aside>

      <div className="grid min-h-[70svh] grid-rows-[auto_1fr_auto] overflow-hidden rounded-[2rem] border border-border/70 bg-white/80 shadow-[0_28px_80px_-45px_rgba(17,24,39,0.35)] backdrop-blur-xl">
        <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Conversation</p>
            <h3 className="mt-1 truncate text-lg font-semibold tracking-[-0.04em]">{conversationId}</h3>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">{messages.length} messages</Badge>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-64 items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-background/70 px-6 text-center">
              <div className="max-w-sm space-y-3">
                <p className="text-lg font-medium tracking-[-0.04em]">Send the first line</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Type a short message, choose a target language, and the stream will fill this area.
                </p>
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

        <div className="border-t border-border/70 bg-background/85 px-5 py-4 sm:px-6">
          <div className="grid gap-4">
            <form
              className="flex flex-col gap-3 rounded-[1.4rem] border border-border/70 bg-white/70 p-3 sm:flex-row sm:items-center"
              onSubmit={submitRoomChange}
            >
              <div className="min-w-0 flex-1">
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
              <Button className="min-w-32" size="lg" type="submit" variant="outline">
                <ArrowRightLeft className="size-4" />
                Join room
              </Button>
            </form>
            <form className="grid gap-4" onSubmit={submit}>
              <Textarea
                id="message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Write naturally. The translation stream will follow."
                rows={4}
              />
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                  <p className="text-xs leading-5 text-muted-foreground">
                    Current room: {conversationId}. Messages are isolated by room id.
                  </p>
                </div>
                <Button className="min-w-32" disabled={!canSend} size="lg" type="submit">
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
