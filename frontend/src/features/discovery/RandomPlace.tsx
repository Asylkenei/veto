import { useRef, useState } from 'react'
import { Check, Plus, RefreshCw, Shuffle } from 'lucide-react'
import { api } from '../../lib/api'
import { ErrorNotice } from '../../components/States'
import { PlaceCover } from './PlaceVisual'
import type { Place } from './types'

export function RandomPlace({ onAdd, category }: { onAdd: (p: Place) => void; category?: string | null }) {
  const [place, setPlace] = useState<Place | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const shown = useRef<string[]>([])
  async function roll() {
    setBusy(true); setError('')
    try {
      const r = await api.randomPlace(shown.current, category)
      if (r.exhausted) { shown.current = []; setNote('Вы посмотрели все варианты — начинаем круг заново.') } else setNote(r.note)
      shown.current = [...shown.current, r.place.id]
      setPlace(r.place)
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось подобрать место') } finally { setBusy(false) }
  }
  async function visited() {
    if (!place) return
    await api.setVisited(place.id, true).catch(() => null)
    void roll()
  }
  if (!place) return <button className="random-start" onClick={() => void roll()} disabled={busy}>
    <span className="random-plus"><Shuffle size={22} /></span>
    <b>{busy ? 'Подбираем…' : 'Найти место'}</b>
    <span>Случайная идея, где вы, возможно, ещё не были</span>
    {error && <ErrorNotice message={error} />}
  </button>
  return <article className="random-card">
    <PlaceCover place={place} size="lg" />
    <div className="random-body">
      <small className="muted">{note}</small>
      <div className="place-tags"><span>{place.category.name}</span><span>{place.city}</span></div>
      <h3>{place.name}</h3>
      <p>{place.summary}</p>
      {place.why_visit && <p className="why"><b>Почему стоит сходить.</b> {place.why_visit}</p>}
      <div className="row-start wrap">
        <button className="btn primary small" onClick={() => onAdd(place)}><Plus size={14} />Добавить в решение</button>
        <button className="btn small" onClick={() => void visited()}><Check size={14} />Я здесь был(а)</button>
        <button className="btn ghost small" onClick={() => void roll()} disabled={busy}><RefreshCw size={14} />Ещё вариант</button>
      </div>
      {error && <ErrorNotice message={error} />}
    </div>
  </article>
}
