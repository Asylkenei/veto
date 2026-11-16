import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Clock3, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/auth'
import { Modal } from '../../components/Modal'
import { ErrorNotice, LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { DrawnCheck, RollingNumber } from '../../lib/motion'
import { METHODS } from './types'
import { useRoom } from './useRoom'

export function VotingPage() {
  const { room, setRoom, loading, error } = useRoom()
  const { user } = useApp()
  const navigate = useNavigate()
  const [choice, setChoice] = useState('')
  const [details, setDetails] = useState<Record<string, 'yes' | 'no'>>({})
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmFinish, setConfirmFinish] = useState(false)

  // When the last vote arrives (from anyone) everyone moves to the result together.
  useEffect(() => { if (room && ['COMPLETED', 'NO_CONSENSUS'].includes(room.status)) navigate(`/rooms/${room.id}/results`, { replace: true }) }, [room, navigate])

  if (loading) return <LoadingState label="Загружаем голосование…" />
  if (error || !room) return <div className="page narrow"><ErrorNotice message={error || 'Комната недоступна'} /></div>
  const activeRoom = room
  const round = room.rounds.at(-1)
  if (room.status !== 'VOTING' || !round) return <div className="page narrow"><ErrorNotice message="Голосование сейчас не идёт." /><Link to={`/rooms/${room.id}`} className="btn">Вернуться в комнату</Link></div>
  const voted = round.ballots.some((b) => b.participant_id === user.id)
  const inRound = round.participant_ids.includes(user.id)
  const options = room.options.filter((o) => round.option_ids.includes(o.id))
  const complete = room.method === 'objections' ? Object.keys(details).length === options.length : !!choice
  const count = round.ballots.length
  async function submit() {
    setBusy(true); setActionError('')
    try { setRoom(activeRoom.method === 'objections' ? await api.vote(activeRoom.id, { details }) : await api.vote(activeRoom.id, { choice_option_id: choice })) }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Не удалось отправить голос') } finally { setBusy(false) }
  }
  async function finish() {
    setBusy(true)
    try { setRoom(await api.finish(activeRoom.id)) } catch (e) { setActionError(e instanceof Error ? e.message : 'Не удалось завершить') } finally { setBusy(false); setConfirmFinish(false) }
  }
  return <div className="page narrow">
    <Link to={`/rooms/${room.id}`} className="back-link"><ArrowLeft size={15} />Комната</Link>
    <div className="room-meta"><span>{METHODS[room.method].name}</span>{round.kind === 'runoff' && <span className="status status-voting">Повторное голосование между лидерами</span>}{room.deadline && <span><Clock3 size={13} />до {formatDateTime(room.deadline)}</span>}</div>
    <h1>{room.question}</h1>
    <p className="lead">{room.method === 'objections' ? 'Отметьте позицию по каждому варианту.' : 'Выберите один вариант. До отправки выбор можно изменить.'}</p>
    <section className="card vote-card">
      <p className="rule"><ShieldCheck size={16} />{METHODS[room.method].detail}</p>
      {!inRound ? <ErrorNotice message="Вы присоединились после старта — в этом раунде голосуют только зафиксированные участники." /> : voted ? <div className="vote-done"><DrawnCheck /><h2>Ваш голос принят</h2><p>Итог появится у всех одновременно, когда проголосует последний участник.</p></div> : <>
        <div className="vote-options" role={room.method === 'objections' ? undefined : 'radiogroup'}>{options.map((o) => room.method === 'objections'
          ? <div className="vote-option is-stance" key={o.id}>{o.image_url && <img className="option-thumb" src={o.image_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}<div><b>{o.title}</b>{o.description && <small>{o.description}</small>}</div>
            <div className="stance" role="radiogroup" aria-label={o.title}>
              <button role="radio" aria-checked={details[o.id] === 'yes'} className={details[o.id] === 'yes' ? 'yes' : ''} onClick={() => setDetails({ ...details, [o.id]: 'yes' })}><Check size={14} />Подходит</button>
              <button role="radio" aria-checked={details[o.id] === 'no'} className={details[o.id] === 'no' ? 'no' : ''} onClick={() => setDetails({ ...details, [o.id]: 'no' })}>Против</button></div></div>
          : <button key={o.id} role="radio" aria-checked={choice === o.id} className={`vote-option ${choice === o.id ? 'selected' : ''}`} onClick={() => setChoice(o.id)}><span className="radio" />{o.image_url && <img className="option-thumb" src={o.image_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}<span><b>{o.title}</b>{o.description && <small>{o.description}</small>}</span></button>)}</div>
        {actionError && <ErrorNotice message={actionError} />}
        <button className="btn primary full large" disabled={!complete || busy} onClick={() => void submit()}>{busy ? 'Отправляем…' : 'Подтвердить голос'}</button>
      </>}
      <div className="vote-progress"><div className="row-between"><span>Проголосовали</span><b><RollingNumber value={count} /> из {round.participant_ids.length}</b></div>
        <div className="bar"><span style={{ width: `${(count / Math.max(1, round.participant_ids.length)) * 100}%` }} /></div>
        <ul className="voters">{room.participants.filter((p) => round.participant_ids.includes(p.id)).map((p) => { const has = round.ballots.some((b) => b.participant_id === p.id); return <li key={p.id} className={has ? 'has-voted' : ''}>{has && <Check size={12} />}{p.display_name}</li> })}</ul>
      </div>
      <p className="muted small">{room.hide_results ? 'Голоса скрыты до завершения.' : 'Ваш голос нельзя изменить после отправки.'}</p>
      {room.is_host && <div className="host-zone"><div><b>Не все успевают?</b><span>Можно завершить досрочно — итог посчитается по {count} {count === 1 ? 'голосу' : 'голосам'}.</span></div><button className="btn small" onClick={() => setConfirmFinish(true)} disabled={!count}>Завершить сейчас</button></div>}
    </section>
    <Modal open={confirmFinish} onClose={() => setConfirmFinish(false)} title="Завершить голосование досрочно?">
      <p>Результат будет рассчитан только по полученным голосам ({count} из {round.participant_ids.length}). Не проголосовавшие увидят итог без учёта своего мнения.</p>
      <div className="modal-actions"><button className="btn" onClick={() => setConfirmFinish(false)}>Подождать</button><button className="btn primary" onClick={() => void finish()} disabled={busy}>Завершить и посчитать</button></div>
    </Modal>
  </div>
}
