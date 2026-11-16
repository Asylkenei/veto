import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { ErrorNotice, Skeleton } from '../../components/States'
import { AddToDecisionModal } from './AddToDecisionModal'
import { Carousel } from './Carousel'
import { PlaceCard } from './PlaceCard'
import { PlaceOfDay } from './PlaceOfDay'
import { RandomPlace } from './RandomPlace'
import type { Place } from './types'
import { usePlaceToggles } from './usePlaces'

function CarouselSkeleton() { return <div className="carousel-track">{[0, 1, 2].map((i) => <div className="place-card" key={i}><Skeleton className="cover" /><Skeleton className="line" /><Skeleton className="line short" /></div>)}</div> }

export function DiscoverySections() {
  const [recent, setRecent] = useState<Place[] | null>(null)
  const [popular, setPopular] = useState<{ is_popularity: boolean; items: Place[] } | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState<Place | null>(null)
  useEffect(() => {
    api.recentPlaces().then(setRecent).catch((e) => { setRecent([]); setError(e.message) })
    api.popularPlaces().then(setPopular).catch((e) => { setPopular({ is_popularity: false, items: [] }); setError(e.message) })
  }, [])
  const update = useCallback((p: Place) => {
    setRecent((l) => l?.map((x) => (x.id === p.id ? p : x)) ?? l)
    setPopular((s) => (s ? { ...s, items: s.items.map((x) => (x.id === p.id ? p : x)) } : s))
  }, [])
  const { toggleSaved } = usePlaceToggles(update)
  return <>
    <section className="section">
      <div className="section-head"><div><h2>Идеи для вас</h2><p className="muted">Из ваших прошлых решений и из того, что выбирают в VETO</p></div><Link to="/explore" className="link">Все места</Link></div>
      {error && <ErrorNotice message={error} />}
      <h3 className="subhead">Недавно выбирали</h3>
      {!recent ? <CarouselSkeleton /> : recent.length ? <Carousel label="Недавно выбирали">{recent.map((p) => <PlaceCard key={p.id} place={p} onAdd={setAdding} onSave={(x) => void toggleSaved(x)} />)}</Carousel>
        : <div className="inline-empty"><b>История пока пустая</b><p>Добавьте место в решение — оно появится здесь. А пока загляните в <Link to="/explore" className="link">Интересное</Link>.</p></div>}
      <h3 className="subhead">{popular?.is_popularity === false ? 'Подборка VETO' : 'Популярное'}</h3>
      {popular?.is_popularity === false && <p className="muted small">Пока мало данных о выборе — показываем подборку, а не рейтинг.</p>}
      {!popular ? <CarouselSkeleton /> : <Carousel label="Популярное">{popular.items.map((p) => <PlaceCard key={p.id} place={p} onAdd={setAdding} onSave={(x) => void toggleSaved(x)} showPopularity={popular.is_popularity} />)}</Carousel>}
    </section>
    <section className="section">
      <div className="section-head"><div><h2>Интересное</h2><p className="muted">Когда хочется чего-то нового</p></div></div>
      <div className="explore-duo"><RandomPlace onAdd={setAdding} /><PlaceOfDay onAdd={setAdding} /></div>
    </section>
    <AddToDecisionModal place={adding} onClose={() => setAdding(null)} />
  </>
}
