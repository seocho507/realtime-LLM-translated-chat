import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ChatMessage {
  id: string
  senderDisplayName: string
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
  if (status === 'error' || status === 'original') {
    return 'outline'
  }
  return 'secondary'
}

export function TranslationBubble({ message }: { message: ChatMessage }) {
  const [showOriginal, setShowOriginal] = useState(false)
  const originalPanelId = `original-${message.id}`

  return (
    <article className="animate-in fade-in-0 slide-in-from-bottom-3 duration-500 border-t border-border/60 py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 space-y-2">
        <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">{message.senderDisplayName}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Badge className="px-2 py-0 text-[10px]" variant="outline">
              {message.src.toUpperCase()}
            </Badge>
            <ArrowRight className="size-2.5" />
            <Badge className="px-2 py-0 text-[10px]" variant="outline">
              {message.dst.toUpperCase()}
            </Badge>
            <Badge className="px-2 py-0 text-[10px]" variant={getStatusVariant(message.status)}>
              {message.status}
            </Badge>
          </div>
          <Button
            aria-controls={originalPanelId}
            aria-expanded={showOriginal}
            className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
            onClick={() => setShowOriginal((current) => !current)}
            size="default"
            type="button"
            variant="ghost"
          >
            {showOriginal ? 'Hide original' : 'Show original'}
            {showOriginal ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-primary/15 bg-primary/5 px-4 py-4 sm:px-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {message.status === 'original' ? 'Original fallback' : 'Translation'}
        </p>
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
