import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Room } from './types'

/** Rooms list; refreshed when the user SSE stream reports a change in any room. */
export function useRooms() {
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { setRooms(await api.rooms()); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить решения') }
  }, [])
  useEffect(() => {
    void load()
    const on = () => void load()
    window.addEventListener('veto:rooms-changed', on)
    return () => window.removeEventListener('veto:rooms-changed', on)
  }, [load])
  return { rooms, error, reload: load }
}
