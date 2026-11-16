import { useState } from 'react'
import { Heart, Landmark, MapPin, Mountain, Sparkles, Users, UtensilsCrossed } from 'lucide-react'
import type { Place } from './types'

const ICONS: Record<string, typeof MapPin> = { heart: Heart, users: Users, mountain: Mountain, utensils: UtensilsCrossed, sparkles: Sparkles, landmark: Landmark }

/** Cached topical photo with attribution; category cover until it loads or if there is none. */
export function PlaceCover({ place, size = 'md' }: { place: Place; size?: 'md' | 'lg' }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const Icon = ICONS[place.category.icon] ?? MapPin
  const photo = place.image_url && state !== 'error'
  return <div className={`place-cover cover-${size} cat-${place.category.id} ${photo && state === 'ok' ? 'has-photo' : ''}`}>
    <span className="cover-letter" aria-hidden="true">{place.name[0]}</span>
    <Icon className="cover-icon" size={size === 'lg' ? 22 : 18} aria-hidden="true" />
    {photo && <img src={place.image_url} alt={place.name} loading="lazy" className={state === 'ok' ? 'is-loaded' : ''} onLoad={() => setState('ok')} onError={() => setState('error')} />}
    {photo && state === 'ok' && place.image_credit && <small className="photo-credit">{place.image_credit}</small>}
  </div>
}
