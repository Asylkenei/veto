import { Bookmark, Plus } from 'lucide-react'
import type { Place } from './types'
import { PlaceCover } from './PlaceVisual'

export function PlaceCard({ place, onAdd, onSave, showPopularity = false }: { place: Place; onAdd: (p: Place) => void; onSave?: (p: Place) => void; showPopularity?: boolean }) {
  return <article className="place-card">
    <PlaceCover place={place} />
    <div className="place-body">
      <div className="place-tags"><span>{place.category.name}</span><span>{place.city}</span></div>
      <h3>{place.name}</h3>
      <p>{place.summary}</p>
      {showPopularity && place.times_chosen > 0 && <small className="muted">Выбирали в {place.times_chosen} {place.times_chosen === 1 ? 'решении' : 'решениях'}</small>}
      {place.visited && <small className="muted">Вы здесь были</small>}
    </div>
    <div className="place-actions">
      <button className="btn small" onClick={() => onAdd(place)}><Plus size={14} />В решение</button>
      {onSave && <button className={`icon-btn small ${place.saved ? 'is-on' : ''}`} onClick={() => onSave(place)} aria-pressed={place.saved} aria-label={place.saved ? 'Убрать из сохранённых' : 'Сохранить'}><Bookmark size={15} /></button>}
    </div>
  </article>
}
