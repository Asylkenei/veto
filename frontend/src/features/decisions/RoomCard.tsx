import { Link } from 'react-router-dom'
import { Clock3, Users } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { formatDateTime, people, timeAgo } from '../../lib/format'
import { METHODS, STATUS_LABELS, type Room } from './types'

export function roomStage(room: Room) {
  const rnd = room.rounds.at(-1)
  if (room.status === 'VOTING' && rnd) {
    const voted = rnd.ballots.some((b) => b.participant_id === room.current_user_id)
    return { label: voted ? 'Ваш голос учтён' : 'Ждёт вашего голоса', progress: `${rnd.ballots.length} из ${rnd.participant_ids.length} проголосовали`, urgent: !voted }
  }
  if (room.status === 'COLLECTING' || room.status === 'READY') {
    const accepted = room.options.filter((o) => o.status === 'ACCEPTED').length
    return { label: 'Сбор вариантов', progress: accepted ? `${accepted} вариантов готово` : 'Вариантов пока нет', urgent: false }
  }
  const result = rnd?.result
  const title = result?.winner?.title ?? (result?.acceptable?.length ? result.acceptable.map((o) => o.title).join(', ') : null)
  return { label: STATUS_LABELS[room.status], progress: title ? `Итог: ${title}` : rnd?.tiebreak ? `Случайный выбор: ${rnd.tiebreak.option.title}` : 'Общее решение не найдено', urgent: false }
}

export function roomLink(room: Room) {
  if (room.status === 'VOTING') return `/rooms/${room.id}/vote`
  if (['COMPLETED', 'NO_CONSENSUS'].includes(room.status)) return `/rooms/${room.id}/results`
  return `/rooms/${room.id}`
}

export function RoomCard({ room }: { room: Room }) {
  const stage = roomStage(room)
  const done = ['COMPLETED', 'NO_CONSENSUS', 'CANCELLED'].includes(room.status)
  return <article className={`room-card ${stage.urgent ? 'is-urgent' : ''}`}>
    <Link to={roomLink(room)} className="room-card-link" aria-label={`${room.title}: ${done ? 'смотреть итог' : 'продолжить'}`} />
    <div className="room-card-top">
      <span className={`status status-${room.status.toLowerCase()}`}>{stage.label}</span>
      <span className="room-card-method">{METHODS[room.method].name}</span>
    </div>
    <h3>{room.title}</h3>
    <p className="room-card-q">{room.question}</p>
    <p className="room-card-progress">{stage.progress}</p>
    <div className="room-card-foot">
      <span className="avatars">{room.participants.slice(0, 4).map((p) => <Avatar key={p.id} name={p.display_name} color={p.avatar_color} size="sm" />)}</span>
      <span className="meta"><Users size={14} />{people(room.participant_count)}</span>
      <span className="meta"><Clock3 size={14} />{room.status === 'VOTING' && room.deadline ? `до ${formatDateTime(room.deadline)}` : timeAgo(room.updated_at ?? room.created_at)}</span>
      <span className="room-card-cta">{done ? 'Итог' : 'Продолжить'}</span>
    </div>
  </article>
}
