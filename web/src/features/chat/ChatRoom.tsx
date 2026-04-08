import { FormEvent, useState } from 'react'

import type { AuthSession } from '../auth/useGoogleAuth'
import { TranslationBubble } from './TranslationBubble'
import { useChatSocket } from './useChatSocket'

export function ChatRoom({ session, apiBaseUrl }: { session: AuthSession; apiBaseUrl: string }) {
  const [draft, setDraft] = useState('')
  const [targetLang, setTargetLang] = useState('en')
  const [conversationId] = useState('demo-room')
  const { connected, messages, sendMessage } = useChatSocket({
    apiBaseUrl,
    conversationId,
    token: session.token,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) {
      return
    }
    sendMessage(text, targetLang)
    setDraft('')
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <header>
        <h2>Chat</h2>
        <p>
          Signed in as {session.user.email} · {connected ? 'connected' : 'connecting'}
        </p>
      </header>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="message">Message</label>
        <textarea id="message" value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} />
        <label htmlFor="targetLang">Target language</label>
        <select id="targetLang" value={targetLang} onChange={(event) => setTargetLang(event.target.value)}>
          <option value="en">English</option>
          <option value="ko">Korean</option>
          <option value="ja">Japanese</option>
        </select>
        <button type="submit">Send</button>
      </form>
      <div style={{ display: 'grid', gap: 12 }}>
        {messages.length === 0 ? <p>No messages yet.</p> : null}
        {messages.map((message) => (
          <TranslationBubble key={message.id} message={message} />
        ))}
      </div>
    </section>
  )
}
