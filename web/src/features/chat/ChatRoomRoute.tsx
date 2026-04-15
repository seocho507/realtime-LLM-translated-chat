import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import type { AuthSession } from '../auth/useGoogleAuth'
import { ChatRoom } from './ChatRoom'
import { buildChatPath, getNormalizedRoomIdParam } from './roomId'

export function ChatRoomRoute({
  apiBaseUrl,
  onLeave,
  onRequireAuth,
  session,
}: {
  apiBaseUrl: string
  onLeave(): Promise<void>
  onRequireAuth(roomId: string): void
  session: AuthSession | null
}) {
  const navigate = useNavigate()
  const { roomId: rawRoomId } = useParams<{ roomId: string }>()
  const roomId = getNormalizedRoomIdParam(rawRoomId)

  useEffect(() => {
    if (rawRoomId !== roomId) {
      navigate(buildChatPath(roomId), { replace: true })
    }
  }, [navigate, rawRoomId, roomId])

  useEffect(() => {
    if (!session && rawRoomId === roomId) {
      onRequireAuth(roomId)
      navigate('/', { replace: true })
    }
  }, [navigate, onRequireAuth, rawRoomId, roomId, session])

  if (!session || rawRoomId !== roomId) {
    return null
  }

  return (
    <ChatRoom
      apiBaseUrl={apiBaseUrl}
      conversationId={roomId}
      onLeave={() => void onLeave()}
      onRoomChange={(nextRoomId) => navigate(buildChatPath(nextRoomId), { replace: true })}
      session={session}
    />
  )
}
