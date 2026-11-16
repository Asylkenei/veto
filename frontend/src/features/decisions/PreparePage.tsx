import { useState } from 'react'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNotice, LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { formatDateTime, people, plural } from '../../lib/format'
import { METHODS } from './types'
import { useRoom } from './useRoom'

export function PreparePage() {
  const { room, loading, error } = useRoom()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  async function start() {
    if (!room) return
    setBusy(true); setActionError('')
    try { await api.start(room.id); navigate(`/rooms/${room.id}/vote`) } catch (e) { setActionError(e instanceof Error ? e.message : 'Не удалось начать голосование') } finally { setBusy(false) }
  }
  if (loading) return <LoadingState />
  if (error || !room) return <div className="page narrow"><ErrorNotice message={error || 'Комната недоступна'} /></div>
  if (!room.is_host) return <div className="page narrow"><ErrorNotice message="Подготовить голосование может только организатор." /><Link to={`/rooms/${room.id}`} className="btn">Вернуться в комнату</Link></div>
  const candidates = room.options.filter((o) => o.status === 'ACCEPTED')
  const pending = room.options.filter((o) => o.status === 'PENDING').length
  const blockers = [room.participant_count < 2 && 'Пригласите хотя бы одного участника помимо себя.', !candidates.length && 'Добавьте и примите хотя бы один вариант.'].filter(Boolean) as string[]
  return <div className="page narrow">
    <Link to={`/rooms/${room.id}`} className="back-link"><ArrowLeft size={15} />Комната</Link>
    <h1>Перед запуском</h1>
    <p className="lead">Проверьте вопрос, участников и список вариантов. После запуска их нельзя будет менять.</p>
    <section className="card">
      <dl className="review">
        <div><dt>Вопрос</dt><dd>{room.question}</dd></div>
        <div><dt>Метод</dt><dd>{METHODS[room.method].name}<small>{METHODS[room.method].detail}</small></dd></div>
        <div><dt>Участники</dt><dd>{people(room.participant_count)}<small>{room.participants.map((p) => p.display_name).join(', ')}</small></dd></div>
        <div><dt>Варианты</dt><dd>{plural(candidates.length, 'вариант', 'варианта', 'вариантов')}{pending > 0 && <small>{pending} на рассмотрении не попадут в голосование</small>}
          <ul className="plain-list">{candidates.map((o) => <li key={o.id}>{o.title}</li>)}</ul></dd></div>
        {room.deadline && <div><dt>Срок</dt><dd>{formatDateTime(room.deadline)}</dd></div>}
      </dl>
      <div className="notice"><LockKeyhole size={16} /><span>После запуска состав участников и варианты будут зафиксированы до конца раунда.</span></div>
      {blockers.map((b) => <p className="field-error" key={b}>{b}</p>)}
      {actionError && <ErrorNotice message={actionError} />}
      <div className="wizard-actions"><Link className="btn" to={`/rooms/${room.id}`}><ArrowLeft size={15} />Вернуться</Link><button className="btn primary" onClick={() => void start()} disabled={busy || blockers.length > 0}>{busy ? 'Запускаем…' : 'Начать голосование'}</button></div>
    </section>
  </div>
}
