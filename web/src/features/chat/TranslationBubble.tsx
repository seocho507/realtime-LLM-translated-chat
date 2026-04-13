import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ChatMessage {
  id: string
  original: string
  translated: string
  status: string
  src: string
  dst: string
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'translated') {
    return 'default'
  }
  if (status === 'error') {
    return 'outline'
  }
  return 'secondary'
}

export function TranslationBubble({ message }: { message: ChatMessage }) {
  const [showOriginal, setShowOriginal] = useState(false)
  const originalPanelId = `original-${message.id}`

  return (
    <article className="animate-in fade-in-0 slide-in-from-bottom-3 duration-500 border-t border-border/60 py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{message.src.toUpperCase()}</Badge>
          <ArrowRight className="size-3" />
          <Badge variant="outline">{message.dst.toUpperCase()}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(message.status)}>{message.status}</Badge>
          <Button
            aria-controls={originalPanelId}
            aria-expanded={showOriginal}
            onClick={() => setShowOriginal((current) => !current)}
            size="default"
            type="button"
            variant="ghost"
          >
            {showOriginal ? 'Hide original' : 'Show original'}
            {showOriginal ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-primary/15 bg-primary/5 px-4 py-4 sm:px-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Translation</p>
        <p className="mt-3 text-sm leading-7 text-foreground">{message.translated || 'Translating...'}</p>
      </div>

      {showOriginal ? (
        <div className="mt-3 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <div
            className="rounded-[1.4rem] border border-border/70 bg-background px-4 py-4 sm:px-5"
            id={originalPanelId}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Original</p>
            <p className="mt-3 text-sm leading-7 text-foreground">{message.original}</p>
          </div>
        </div>
      ) : null}
    </article>
  )
}
