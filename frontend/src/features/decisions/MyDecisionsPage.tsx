import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { EmptyState, ErrorNotice, Skeleton } from '../../components/States'
import { RoomCard } from './RoomCard'
import { ACTIVE_STATUSES, DONE_STATUSES } from './types'
import { useRooms } from './useRooms'

export function MyDecisionsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'done' ? 'done' : 'active'
  const [q, setQ] = useState('')
  const { rooms, error, reload } = useRooms()
  const list = useMemo(() => (rooms ?? [])
    .filter((r) => (tab === 'done' ? DONE_STATUSES : ACTIVE_STATUSES).includes(r.status))
    .filter((r) => !q.trim() || `${r.title} ${r.question}`.toLowerCase().includes(q.trim().toLowerCase())), [rooms, tab, q])
  const count = (statuses: string[]) => rooms?.filter((r) => statuses.includes(r.status)).length ?? 0
  return <div className="page">
    <div className="page-head"><div><h1>Мои решения</h1><p className="lead">Решения, которые вы создали, и те, куда вас пригласили.</p></div><Link to="/decisions/new" className="btn primary"><Plus size={16} />Создать решение</Link></div>
    <div className="toolbar">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : ''} onClick={() => setParams({})}>Активные <span>{count(ACTIVE_STATUSES)}</span></button>
        <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'active' : ''} onClick={() => setParams({ tab: 'done' })}>Завершённые <span>{count(DONE_STATUSES)}</span></button>
      </div>
      <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти решение" aria-label="Поиск по решениям" /></label>
    </div>
    {error && <ErrorNotice message={error} onRetry={() => void reload()} />}
    {!rooms && !error && <div className="room-grid">{[0, 1, 2].map((i) => <div className="room-card" key={i}><Skeleton className="line short" /><Skeleton className="line" /></div>)}</div>}
    {rooms && !list.length && (q ? <p className="muted">Ничего не нашлось по запросу «{q}».</p> : tab === 'done'
      ? <EmptyState title="Завершённых решений пока нет" description="Здесь будет история: итоги, распределение голосов и объяснение результата." cta="" />
      : <EmptyState title="Нет активных решений" description="Создайте решение или присоединитесь по коду приглашения." />)}
    {!!list.length && <div className="room-grid">{list.map((room) => <RoomCard key={room.id} room={room} />)}</div>}
  </div>
}
