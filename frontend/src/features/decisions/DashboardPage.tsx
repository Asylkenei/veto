import { Link } from 'react-router-dom'
import { useApp } from '../../app/auth'
import { EmptyState, ErrorNotice, Skeleton } from '../../components/States'
import { plural } from '../../lib/format'
import { Hero } from './Hero'
import { DiscoverySections } from '../discovery/DiscoverySections'
import { PushPrompt } from '../notifications/push'
import { RoomCard } from './RoomCard'
import { ACTIVE_STATUSES, DONE_STATUSES } from './types'
import { useRooms } from './useRooms'

export function DashboardPage() {
  const { user } = useApp()
  const { rooms, error, reload } = useRooms()
  const active = rooms?.filter((r) => ACTIVE_STATUSES.includes(r.status)) ?? []
  const done = rooms?.filter((r) => DONE_STATUSES.includes(r.status)) ?? []
  const waiting = active.filter((r) => r.status === 'VOTING' && !r.rounds.at(-1)?.ballots.some((b) => b.participant_id === user.id)).length
  const message = !rooms ? ' ' : waiting
    ? `${plural(waiting, 'решение ждёт', 'решения ждут', 'решений ждут')} вашего голоса.`
    : active.length ? 'Все голоса отданы — можно спокойно ждать итогов.' : 'Соберите друзей и договоритесь о чём-нибудь хорошем.'
  return <div className="page">
    <Hero name={user.display_name} rooms={rooms} message={message} />
    {user.is_guest && <div className="banner"><span>Вы вошли как гость. Добавьте email и пароль, чтобы не потерять решения на другом устройстве.</span><Link className="btn small" to="/register">Сохранить аккаунт</Link></div>}
    <PushPrompt />

    <section className="section">
      <div className="section-head"><h2>Активные решения</h2>{active.length > 0 && <Link to="/decisions" className="link">Все решения</Link>}</div>
      {error && <ErrorNotice message={error} onRetry={() => void reload()} />}
      {!rooms && !error && <div className="room-grid">{[0, 1].map((i) => <div className="room-card" key={i}><Skeleton className="line short" /><Skeleton className="line" /><Skeleton className="line" /></div>)}</div>}
      {rooms && !active.length && <EmptyState title="Пока ни одного решения" description="Сформулируйте вопрос, пригласите участников по ссылке и выберите, как будете договариваться." cta="Создать первое решение" />}
      {!!active.length && <div className="room-grid">{active.map((room) => <RoomCard key={room.id} room={room} />)}</div>}
    </section>

    {!!done.length && <section className="section">
      <div className="section-head"><h2>Завершённые</h2><Link to="/decisions?tab=done" className="link">Вся история</Link></div>
      <div className="room-grid compact">{done.slice(0, 3).map((room) => <RoomCard key={room.id} room={room} />)}</div>
    </section>}

    <DiscoverySections />
  </div>
}
