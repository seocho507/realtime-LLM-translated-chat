import { useEffect, useMemo, useRef, useState } from 'react'

import { ChatMessage } from './TranslationBubble'
import { createTranslationBuffer } from './translationBuffer'

function toWebSocketUrl(apiBaseUrl: string, conversationId: string, token?: string) {
  const url = new URL(apiBaseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/ws/chat/${conversationId}`
  if (token) {
    url.searchParams.set('token', token)
  }
  return url.toString()
}

export function useChatSocket({
  apiBaseUrl,
  conversationId,
  token,
}: {
  apiBaseUrl: string
  conversationId: string
  token?: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const buffer = useMemo(
    () =>
      createTranslationBuffer(40, ({ id, text }) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === id ? { ...message, translated: `${message.translated}${text}` } : message,
          ),
        )
      }),
    [],
  )

  useEffect(() => {
    const socket = new WebSocket(toWebSocketUrl(apiBaseUrl, conversationId, token))
    socketRef.current = socket
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as Record<string, string>
      if (payload.t === 'msg_start') {
        setMessages((current) => {
          const next = current.filter((message) => message.id !== payload.id)
          next.push({
            id: payload.id,
            original: payload.original,
            translated: '',
            status: payload.status ?? 'translating',
            src: payload.src ?? 'auto',
            dst: payload.dst ?? 'en',
          })
          return next
        })
      }
      if (payload.t === 'msg_delta') {
        buffer.add({ id: payload.id!, text: payload.text ?? '' })
      }
      if (payload.t === 'msg_final') {
        buffer.flush()
        setMessages((current) =>
          current.map((message) =>
            message.id === payload.id
              ? { ...message, translated: payload.text ?? message.translated, status: 'translated' }
              : message,
          ),
        )
      }
      if (payload.t === 'msg_error') {
        setMessages((current) =>
          current.map((message) =>
            message.id === payload.id ? { ...message, status: 'error' } : message,
          ),
        )
      }
    }
    return () => {
      buffer.stop()
      socket.close()
    }
  }, [apiBaseUrl, buffer, conversationId, token])

  const sendMessage = (text: string, targetLang: string) => {
    const clientMsgId = `${Date.now()}`
    socketRef.current?.send(
      JSON.stringify({
        type: 'send_message',
        client_msg_id: clientMsgId,
        text,
        source_lang: 'auto',
        target_lang: targetLang,
      }),
    )
  }

  return {
    connected,
    messages,
    sendMessage,
  }
}
