import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, LogOut, Radio, SendHorizonal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { AuthSession } from '../auth/useGoogleAuth'
import { normalizeRoomId } from './roomId'
import { TranslationBubble } from './TranslationBubble'
import { useChatSocket } from './useChatSocket'

function toLanguageLabel(language: string) {
  const labels: Record<string, string> = {
    en: 'English',
    ko: 'Korean',
    ja: 'Japanese',
    zh: 'Chinese',
  }

  return labels[language] ?? language.toUpperCase()
}

export function ChatRoom({
  session,
  apiBaseUrl,
  conversationId,
  onLeave,
  onRoomChange,
}: {
  session: AuthSession
  apiBaseUrl: string
  conversationId: string
  onLeave: () => void
  onRoomChange: (roomId: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [targetLang, setTargetLang] = useState('en')
  const [roomDraft, setRoomDraft] = useState(conversationId)
  const [roomEditorOpen, setRoomEditorOpen] = useState(false)
  const messageViewportRef = useRef<HTMLDivElement | null>(null)
  const { connected, messages, sendMessage } = useChatSocket({
    apiBaseUrl,
    conversationId,
    targetLang,
  })
  const canSend = connected && draft.trim().length > 0
  const roomReadyLabel = connected ? `${toLanguageLabel(targetLang)} translation is ready.` : 'This room is not ready yet.'

  useEffect(() => {
    setRoomDraft(conversationId)
    setRoomEditorOpen(false)
  }, [conversationId])

  useEffect(() => {
    const viewport = messageViewportRef.current
    if (!viewport || messages.length === 0) {
      return
    }
    const lastMessage = messages[messages.length - 1]
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: prefersReducedMotion || lastMessage.translationState === 'streaming' ? 'auto' : 'smooth',
    })
  }, [messages])

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

  const submitRoomChange = (event: FormEvent) => {
    event.preventDefault()
    const nextRoomId = normalizeRoomId(roomDraft)
    setRoomDraft(nextRoomId)
    if (nextRoomId !== conversationId) {
      onRoomChange(nextRoomId)
    }
    setRoomEditorOpen(false)
  }

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    submitDraft()
  }

  return (
    <section className="mx-auto w-full max-w-[32rem]">
      <div
        className="grid min-h-[74svh] w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-[1.8rem] border border-border bg-card shadow-sm"
        data-testid="chat-shell"
      >
        <header className="space-y-4 border-b border-border/70 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Room</p>
              <h3 className="truncate text-lg font-semibold tracking-[-0.04em] text-foreground">{conversationId}</h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{session.user.display_name}</span>
                <span aria-hidden="true">•</span>
                <span className="inline-flex items-center gap-1.5" data-testid="room-connection-state">
                  <Radio className={`size-3.5 ${connected ? 'text-primary' : 'text-muted-foreground'}`} />
                  {connected ? 'Ready to translate' : 'Not ready yet'}
                </span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => setRoomEditorOpen((current) => !current)}
                type="button"
                variant="outline"
              >
                <ArrowRightLeft className="size-4" />
                {roomEditorOpen ? 'Keep this room' : 'Change room'}
              </Button>
              <Button className="w-full" onClick={onLeave} type="button" variant="outline">
                <LogOut className="size-4" />
                Leave
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{roomReadyLabel}</p>
        </header>

        {roomEditorOpen ? (
          <section className="border-b border-border/70 bg-background/70 px-4 py-4">
            <form className="grid gap-3" onSubmit={submitRoomChange}>
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="room-id">
                  Room id
                </label>
                <input
                  className="h-11 w-full rounded-[1rem] border border-border bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60"
                  id="room-id"
                  onChange={(event) => setRoomDraft(event.target.value)}
                  placeholder="Enter room id"
                  value={roomDraft}
                />
              </div>
              <Button className="w-full self-end" size="lg" type="submit" variant="outline">
                <ArrowRightLeft className="size-4" />
                Open room
              </Button>
            </form>
          </section>
        ) : null}

        <div
          className="min-h-[20rem] overflow-y-auto px-4 py-4"
          data-testid="message-viewport"
          ref={messageViewportRef}
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-full items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-background px-5 py-5 text-center">
              <div className="max-w-sm space-y-3">
                <p className="text-base font-medium text-foreground">
                  {connected ? 'Start the first message' : 'This room is not ready yet'}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {connected
                    ? `Everyone in ${conversationId} will see the message in ${toLanguageLabel(targetLang).toLowerCase()} once translation finishes.`
                    : 'You can stay here, switch rooms, or try again once the live connection is available.'}
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

        <div
          className="border-t border-border/70 bg-background px-4 pt-3 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
          data-testid="composer-shell"
        >
          <form className="grid gap-4" data-testid="composer-form" onSubmit={submit}>
            <div className="grid gap-2 rounded-[1.25rem] border border-border bg-card p-3" data-testid="message-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="message">
                  Message
                </label>
                <span className="text-xs text-muted-foreground">Write once. Translation follows for each participant.</span>
              </div>
              <Textarea
                className="min-h-[4.5rem] border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
                id="message"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder={connected ? 'Write your message naturally.' : 'This room is not ready yet.'}
                rows={2}
                value={draft}
              />
            </div>
            <div className="flex flex-col gap-2" data-testid="composer-actions">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="target-language">
                  Translation language
                </label>
                <Select onValueChange={setTargetLang} value={targetLang}>
                  <SelectTrigger aria-label="Target language" className="h-10 w-full" id="target-language">
                    <SelectValue placeholder="Target language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full rounded-[1.1rem]"
                disabled={!canSend}
                size="default"
                type="submit"
              >
                <SendHorizonal className="size-4" />
                {connected ? 'Send message' : 'Room not ready yet'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
