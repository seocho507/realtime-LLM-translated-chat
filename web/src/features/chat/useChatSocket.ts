import { useEffect, useMemo, useRef, useState } from 'react'

import { ChatMessage } from './TranslationBubble'
import { createTranslationBuffer } from './translationBuffer'

function toWebSocketUrl(apiBaseUrl: string, conversationId: string, targetLang?: string) {
  const url = new URL(apiBaseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/ws/chat/${encodeURIComponent(conversationId)}`
  if (targetLang) {
    url.searchParams.set('lang', targetLang)
  }
  return url.toString()
}

export function useChatSocket({
  apiBaseUrl,
  conversationId,
  targetLang,
}: {
  apiBaseUrl: string
  conversationId: string
  targetLang: string
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
    buffer.stop()
    setMessages([])
    setConnected(false)
  }, [buffer, conversationId])

  const upsertMessage = (payload: Record<string, string>) => {
    const nextMessage: ChatMessage = {
      id: payload.id ?? '',
      senderDisplayName: payload.sender_display_name ?? payload.sender_email ?? payload.sender_id ?? 'Unknown',
      original: payload.original ?? '',
      translated: '',
      status: payload.status ?? 'translating',
      src: payload.src ?? 'auto',
      dst: payload.dst ?? 'en',
    }
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === nextMessage.id)
      if (index === -1) {
        return [...current, nextMessage]
      }
      return current.map((message, messageIndex) => (messageIndex === index ? nextMessage : message))
    })
  }

  useEffect(() => {
    const socket = new WebSocket(toWebSocketUrl(apiBaseUrl, conversationId, targetLang))
    socketRef.current = socket
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as Record<string, string>
      if (payload.t === 'msg_start') {
        upsertMessage(payload)
      }
      if (payload.t === 'msg_delta') {
        buffer.add({ id: payload.id!, text: payload.text ?? '' })
      }
      if (payload.t === 'msg_final') {
        buffer.flush()
        setMessages((current) =>
          current.map((message) =>
            message.id === payload.id
              ? {
                  ...message,
                  translated: payload.text ?? message.translated,
                  status: 'translated',
                  dst: payload.dst ?? message.dst,
                }
              : message,
          ),
        )
      }
      if (payload.t === 'msg_error') {
        setMessages((current) =>
          current.map((message) =>
            message.id === payload.id
              ? {
                  ...message,
                  translated: message.original,
                  status: 'original',
                  dst: payload.dst ?? message.dst,
                }
              : message,
          ),
        )
      }
    }
    return () => {
      buffer.stop()
      socket.close()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [apiBaseUrl, buffer, conversationId])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }
    socket.send(
      JSON.stringify({
        type: 'set_target_lang',
        target_lang: targetLang,
      }),
    )
  }, [connected, targetLang])

  const sendMessage = (text: string) => {
    const clientMsgId = `${Date.now()}`
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }
    socket.send(
      JSON.stringify({
        type: 'set_target_lang',
        target_lang: targetLang,
      }),
    )
    socket.send(
      JSON.stringify({
        type: 'send_message',
        client_msg_id: clientMsgId,
        text,
        source_lang: 'auto',
      }),
    )
  }

  return {
    connected,
    messages,
    sendMessage,
  }
}
