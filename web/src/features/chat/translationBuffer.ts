export interface TranslationChunk {
  id: string
  text: string
}

export interface TranslationBuffer {
  add(chunk: TranslationChunk): void
  flush(): void
  stop(): void
}

export function createTranslationBuffer(
  flushMs: number,
  onFlush: (chunk: TranslationChunk) => void,
): TranslationBuffer {
  const pending = new Map<string, string>()
  let timer: number | undefined

  const flush = () => {
    timer = undefined
    for (const [id, text] of pending.entries()) {
      onFlush({ id, text })
    }
    pending.clear()
  }

  return {
    add(chunk) {
      pending.set(chunk.id, `${pending.get(chunk.id) ?? ''}${chunk.text}`)
      if (!timer) {
        timer = window.setTimeout(flush, flushMs)
      }
    },
    flush,
    stop() {
      if (timer) {
        window.clearTimeout(timer)
      }
      timer = undefined
      pending.clear()
    },
  }
}
