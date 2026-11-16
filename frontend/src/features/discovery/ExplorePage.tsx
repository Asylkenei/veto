import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../../lib/api'
import { EmptyState, ErrorNotice, Skeleton } from '../../components/States'
import { AddToDecisionModal } from './AddToDecisionModal'
import { PlaceCard } from './PlaceCard'
import { PlaceOfDay } from './PlaceOfDay'
import { RandomPlace } from './RandomPlace'
import type { Place, PlaceCategory } from './types'
import { usePlaceToggles } from './usePlaces'

export function ExplorePage() {
  const [categories, setCategories] = useState<PlaceCategory[]>([])
  const [category, setCategory] = useState<string>('')
  const [saved, setSaved] = useState(false)
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState<Place | null>(null)
  useEffect(() => { api.placeCategories().then(setCategories).catch(() => setCategories([])) }, [])
  useEffect(() => {
    setPlaces(null)
    const t = window.setTimeout(() => {
      (saved ? api.savedPlaces() : api.places({ category, q })).then((l) => { setPlaces(l); setError('') }).catch((e) => { setError(e.message); setPlaces([]) })
    }, q ? 250 : 0)
    return () => window.clearTimeout(t)
  }, [category, q, saved])
  const update = useCallback((p: Place) => setPlaces((l) => (saved && !p.saved ? l?.filter((x) => x.id !== p.id) : l?.map((x) => (x.id === p.id ? p : x))) ?? null), [saved])
  const { toggleSaved } = usePlaceToggles(update)
  return <div className="page">
    <div className="page-head"><div><h1>Интересное</h1><p className="lead">Места и занятия, которые можно сразу вынести на общее решение.</p></div></div>
    <div className="explore-duo"><RandomPlace onAdd={setAdding} category={category || null} key={category} /><PlaceOfDay onAdd={setAdding} /></div>
    <div className="toolbar">
      <div className="chips" role="tablist" aria-label="Категории">
        <button className={!category && !saved ? 'active' : ''} onClick={() => { setCategory(''); setSaved(false) }}>Все</button>
        {categories.map((c) => <button key={c.id} className={category === c.id && !saved ? 'active' : ''} onClick={() => { setCategory(c.id); setSaved(false) }}>{c.name}</button>)}
        <button className={saved ? 'active' : ''} onClick={() => { setSaved(true); setCategory('') }}>Сохранённые</button>
      </div>
      {!saved && <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" aria-label="Поиск мест" /></label>}
    </div>
    {error && <ErrorNotice message={error} />}
    {!places && <div className="place-grid">{[0, 1, 2, 3].map((i) => <div className="place-card" key={i}><Skeleton className="cover" /><Skeleton className="line" /></div>)}</div>}
    {places && !places.length && <EmptyState title={saved ? 'Сохранённых мест нет' : 'Ничего не нашлось'} description={saved ? 'Нажмите на закладку на карточке, чтобы вернуться к месту позже.' : 'Попробуйте другую категорию или запрос.'} cta="" />}
    {places && !!places.length && <div className="place-grid">{places.map((p) => <PlaceCard key={p.id} place={p} onAdd={setAdding} onSave={(x) => void toggleSaved(x)} showPopularity />)}</div>}
    <AddToDecisionModal place={adding} onClose={() => setAdding(null)} />
  </div>
}
