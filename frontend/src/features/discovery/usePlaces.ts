import { useCallback, useState } from 'react'
import { api } from '../../lib/api'
import type { Place } from './types'

/** Shared optimistic updates for save / visited toggles across lists. */
export function usePlaceToggles(update: (p: Place) => void) {
  const [error, setError] = useState('')
  const toggleSaved = useCallback(async (p: Place) => {
    update({ ...p, saved: !p.saved })
    try { update(await api.setSaved(p.id, !p.saved)) } catch (e) { update(p); setError(e instanceof Error ? e.message : 'Не удалось сохранить') }
  }, [update])
  const toggleVisited = useCallback(async (p: Place) => {
    try { update(await api.setVisited(p.id, !p.visited)) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось отметить') }
  }, [update])
  return { toggleSaved, toggleVisited, error }
}
