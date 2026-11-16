import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/States'
import { PlaceCover } from './PlaceVisual'
import type { Place } from './types'

export function PlaceOfDay({ onAdd }: { onAdd: (p: Place) => void }) {
  const [place, setPlace] = useState<Place | null>(null)
  const [failed, setFailed] = useState(false)
  const [more, setMore] = useState(false)
  useEffect(() => { api.placeOfDay().then((r) => setPlace(r.place)).catch(() => setFailed(true)) }, [])
  if (failed) return null
  if (!place) return <div className="day-card"><Skeleton className="cover" /><Skeleton className="line" /></div>
  return <article className="day-card">
    <PlaceCover place={place} size="lg" />
    <div className="day-body">
      <small className="muted">Место дня · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</small>
      <h3>{place.name}</h3>
      <div className="place-tags"><span>{place.category.name}</span><span>{place.city}</span></div>
      <p>{place.fact || place.summary}</p>
      <div className="row-start wrap"><button className="btn primary small" onClick={() => onAdd(place)}><Plus size={14} />Добавить в решение</button><button className="btn small" onClick={() => setMore(true)}>Подробнее</button></div>
    </div>
    <Modal open={more} onClose={() => setMore(false)} title={place.name}>
      <PlaceCover place={place} size="lg" />
      <div className="place-tags"><span>{place.category.name}</span><span>{place.city}</span></div>
      <p>{place.summary}</p>
      {place.why_visit && <p><b>Почему стоит сходить.</b> {place.why_visit}</p>}
      {place.fact && <p className="muted">{place.fact}</p>}
      <div className="modal-actions"><button className="btn primary" onClick={() => { setMore(false); onAdd(place) }}>Добавить в решение</button></div>
    </Modal>
  </article>
}
