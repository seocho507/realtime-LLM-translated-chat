export interface ChatMessage {
  id: string
  original: string
  translated: string
  status: string
  src: string
  dst: string
}

export function TranslationBubble({ message }: { message: ChatMessage }) {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
      <div>
        <strong>Original</strong>
        <p>{message.original}</p>
      </div>
      <div>
        <strong>Translation</strong>
        <p>{message.translated || 'Translating…'}</p>
      </div>
      <small>
        {message.src} → {message.dst} · {message.status}
      </small>
    </article>
  )
}
