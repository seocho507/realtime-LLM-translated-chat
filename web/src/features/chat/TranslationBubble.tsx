import { useState } from 'react'
import { ChevronDown, ChevronUp, Languages, LoaderCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type TranslationState = 'streaming' | 'ready' | 'fallback'

export interface ChatMessage {
  id: string
  senderDisplayName: string
  original: string
  translated: string
  translationState: TranslationState
  src: string
  dst: string
}

function toLanguageLabel(language: string) {
  const labels: Record<string, string> = {
    auto: 'Detected',
    en: 'English',
    ko: 'Korean',
    ja: 'Japanese',
    zh: 'Chinese',
  }

  return labels[language] ?? language.toUpperCase()
}

function getStatePresentation(state: TranslationState) {
  if (state === 'ready') {
    return {
      tone: 'Translation ready',
      badge: 'Ready',
      badgeVariant: 'default' as const,
    }
  }

  if (state === 'fallback') {
    return {
      tone: 'Showing the original message',
      helper: 'Translation was unavailable for this message.',
      badge: 'Original shown',
      badgeVariant: 'outline' as const,
    }
  }

  return {
    tone: 'Translating',
    badge: 'Live',
    badgeVariant: 'secondary' as const,
  }
}

export function TranslationBubble({ message }: { message: ChatMessage }) {
  const [showOriginal, setShowOriginal] = useState(false)
  const presentation = getStatePresentation(message.translationState)
  const originalPanelId = `original-${message.id}`
  const showOriginalToggle = message.translationState !== 'fallback' && message.original.trim() !== message.translated.trim()
  const primaryText =
    message.translationState === 'fallback' ? message.original : message.translated || 'Translation is arriving…'

  return (
    <article className="animate-in fade-in-0 slide-in-from-bottom-3 duration-500 border-t border-border/60 py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">{message.senderDisplayName}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Languages className="size-3.5" />
              {toLanguageLabel(message.src)} → {toLanguageLabel(message.dst)}
            </span>
            <Badge className="px-2 py-0 text-[10px]" variant={presentation.badgeVariant}>
              {presentation.badge}
            </Badge>
          </div>
        </div>

        {showOriginalToggle ? (
          <Button
            aria-controls={originalPanelId}
            aria-expanded={showOriginal}
            className="h-8 gap-1 px-2 text-[11px] text-muted-foreground"
            onClick={() => setShowOriginal((current) => !current)}
            size="default"
            type="button"
            variant="ghost"
          >
            {showOriginal ? 'Hide original' : 'View original'}
            {showOriginal ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
        ) : null}
      </div>

      <div className="rounded-[1.6rem] border border-primary/15 bg-primary/5 px-4 py-4 sm:px-5">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{presentation.tone}</p>
          {message.translationState === 'fallback' ? (
            <p className="text-xs text-muted-foreground">{presentation.helper}</p>
          ) : null}
        </div>
        {message.translationState === 'streaming' ? (
          <div
            className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground"
            data-testid="translation-streaming-state"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" />
            <span>Translation in progress</span>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-7 text-foreground" data-testid="translation-primary-text">
            {primaryText}
          </p>
        )}
      </div>

      {showOriginal ? (
        <div className="mt-3 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <div className="rounded-[1.4rem] border border-border/70 bg-background px-4 py-4 sm:px-5" id={originalPanelId}>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Original message</p>
            <p className="mt-3 text-sm leading-7 text-foreground">{message.original}</p>
          </div>
        </div>
      ) : null}
    </article>
  )
}
