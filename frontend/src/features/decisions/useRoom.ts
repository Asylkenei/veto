import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useEventStream } from '../../lib/live'
import type { Room } from './types'

const FALLBACK_REFRESH_MS = 15_000

/** Room state: one fetch, then live Server-Sent Events; a slow poll is kept as a safety net. */
export function useRoom() {
  const { roomId = '' } = useParams()
  const [room, setRoomState] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const version = useRef(-1)

  const accept = useCallback((next: Room) => {
    if (next.version >= version.current) { version.current = next.version; setRoomState(next) }
  }, [])

  const refresh = useCallback(async (silent = false) => {
    if (!roomId) return
    if (!silent) setLoading(true)
    try { const latest = await api.room(roomId); version.current = latest.version; setRoomState(latest); setError('') }
    catch (e) { if (!silent) setError(e instanceof Error ? e.message : 'Комната недоступна') }
    finally { if (!silent) setLoading(false) }
  }, [roomId])

  useEffect(() => { version.current = -1; void refresh() }, [refresh])
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void refresh(true) }
    const id = window.setInterval(tick, FALLBACK_REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [refresh])

  useEventStream(room?.is_member ? `/api/rooms/${roomId}/stream` : null, {
    room: (data: Room) => accept(data),
    gone: () => setError('Комната удалена'),
  })

  const setRoom = useCallback((updated: Room) => { version.current = updated.version; setRoomState(updated) }, [])
  return { room, setRoom, loading, error, refresh, roomId }
}
