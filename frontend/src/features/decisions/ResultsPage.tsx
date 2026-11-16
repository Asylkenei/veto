import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Dice5, MessagesSquare, RotateCcw, Scale, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNotice, LoadingState } from '../../components/States'
import { useToast } from '../../components/Toast'
import { api } from '../../lib/api'
import { formatDateTime, plural } from '../../lib/format'
import { RandomizerDrum } from './Randomizer'
import { METHODS, type Room } from './types'
import { useRoom } from './useRoom'

const seenKey = (roundId: string) => `veto.tiebreakSeen.${roundId}`

export function ResultsPage() {
  const { room, setRoom, loading, error } = useRoom()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [playDraw, setPlayDraw] = useState(false)
  const round = room?.rounds.at(-1)
  const tiebreak = round?.tiebreak

  useEffect(() => {
    if (!round?.tiebreak) return
    let seen = false
    try { seen = localStorage.getItem(seenKey(round.id)) === '1'; localStorage.setItem(seenKey(round.id), '1') } catch { /* storage unavailable */ }
    if (!seen) setPlayDraw(true)
  }, [round?.id, round?.tiebreak])
  useEffect(() => { if (room?.status === 'VOTING') navigate(`/rooms/${room.id}/vote`, { replace: true }) }, [room, navigate])

  if (loading) return <LoadingState label="Считаем итог…" />
  if (error || !room) return <div className="page narrow"><ErrorNotice message={error || 'Комната недоступна'} /></div>
  const result = round?.result
  if (!round || !result) return <div className="page narrow"><section className="card center"><Scale size={26} /><h1>Ждём остальных участников</h1><p className="lead">Проголосовали {round?.ballots.length ?? 0} из {round?.participant_ids.length ?? room.participant_count}. Итог посчитает сервер после последнего голоса.</p><Link className="btn" to={`/rooms/${room.id}`}>Вернуться в комнату</Link></section></div>

  const act = async (key: string, fn: () => Promise<Room>, after?: (r: Room) => void) => {
    setBusy(key)
    try { const r = await fn(); setRoom(r); after?.(r) } catch (e) { toast(e instanceof Error ? e.message : 'Не получилось', 'error') } finally { setBusy('') }
  }
  const candidates = result.tiebreak_candidates ?? []
  const canDraw = candidates.length >= 2 && !tiebreak
  const headline = result.success
    ? room.method === 'objections' ? (result.acceptable?.length === 1 ? result.acceptable[0].title : `${plural(result.acceptable?.length ?? 0, 'вариант подходит', 'варианта подходят', 'вариантов подходят')} всем`) : result.winner?.title
    : room.method === 'unanimity' ? 'Единогласия нет' : result.tie ? 'Ничья' : 'Общее решение не найдено'
  // Objections method: show agreement ("3 из 4 согласны"); the rule itself is unchanged.
  const metric = (r: (typeof result.counts)[number]) => room.method === 'objections' ? (r.agree ?? result.submitted - (r.objections ?? 0)) : (r.count ?? 0)
  const rows = [...result.counts].sort((a, b) => metric(b) - metric(a))
  const max = room.method === 'objections' ? Math.max(1, result.submitted) : Math.max(1, ...rows.map(metric))
  const reason = round.end_reason === 'forced' ? 'Организатор завершил голосование досрочно.' : round.end_reason === 'deadline' ? 'Голосование закрылось по сроку.' : ''

  return <div className="page narrow">
    <Link to={`/rooms/${room.id}`} className="back-link"><ArrowLeft size={15} />Комната</Link>
    <div className="room-meta"><span>Раунд {round.number}{round.kind === 'runoff' ? ', повторный' : ''}</span><span>{METHODS[room.method].name}</span><span>Проголосовали {result.submitted} из {result.total}</span>{round.ended_at && <span>{formatDateTime(round.ended_at)}</span>}</div>
    <h1 className="sr-only">Итог: {room.title}</h1>

    <section className={`verdict ${result.success ? 'is-positive' : 'is-negative'}`}>
      <span className="verdict-icon">{result.success ? <Check size={22} /> : <TriangleAlert size={22} />}</span>
      <p className="verdict-q">{room.question}</p>
      <h2>{headline}</h2>
      <p>{result.explanation}</p>
      {reason && <p className="verdict-note">{reason}</p>}
      {room.method === 'objections' && result.success && (result.acceptable?.length ?? 0) > 1 && <ul className="equal-list">{result.acceptable!.map((o) => <li key={o.id}><Check size={14} />{o.title}</li>)}</ul>}
      {room.method === 'majority' && result.tie && <ul className="equal-list">{(result.leaders ?? []).map((o) => <li key={o.id}>{o.title}</li>)}</ul>}
    </section>

    {canDraw && <section className="card deadlock">
      <h2>{result.success ? 'Несколько вариантов одинаково подходят' : 'Не удалось прийти к общему решению'}</h2>
      <p>{result.success ? 'Можно оставить их равнозначными или выбрать один случайно.' : 'Хотите использовать случайный выбор?'} В жребии участвуют только варианты с равным лучшим результатом: {candidates.map((c) => c.title).join(', ')}.</p>
      {room.method === 'unanimity' && <p className="muted small">Случайный выбор не делает решение единогласным — он будет отмечен как отдельный способ выйти из тупика.</p>}
      {room.is_host ? <div className="deadlock-actions">
        <button className="btn primary" disabled={!!busy} onClick={() => void act('draw', () => api.tiebreak(room.id), () => setPlayDraw(true))}><Dice5 size={16} />{busy === 'draw' ? 'Запускаем…' : 'Запустить рандомайзер'}</button>
        <button className="btn" disabled={!!busy} onClick={() => void act('runoff', () => api.runoff(room.id), (r) => navigate(`/rooms/${r.id}/vote`))}><RotateCcw size={16} />Переголосовать между лидерами</button>
        <button className="btn ghost" disabled={!!busy} onClick={() => void act('discuss', () => api.newRound(room.id), (r) => navigate(`/rooms/${r.id}`))}><MessagesSquare size={16} />Вернуться к обсуждению</button>
      </div> : <p className="muted">Организатор может запустить случайный выбор или повторное голосование — вы увидите результат здесь сразу.</p>}
    </section>}

    {tiebreak && <section className="card draw">
      <div className="row-between"><h2>Случайный выбор</h2><span className="tag">Не единогласие</span></div>
      <RandomizerDrum candidates={tiebreak.candidates} target={tiebreak.option} play={playDraw} />
      <p className="draw-result">Выпало: <b>{tiebreak.option.title}</b></p>
      <p className="muted small">{tiebreak.note} Запустил(а) {tiebreak.drawn_by}, {formatDateTime(tiebreak.drawn_at)}. Результат посчитан на сервере и одинаков для всех.</p>
    </section>}

    <section className="card">
      <div className="section-head"><div><h2>Как распределились ответы</h2><p className="muted">{room.method === 'objections' ? 'Сколько участников согласны с вариантом. Проходит вариант, с которым согласны все.' : 'От большего числа голосов к меньшему'}</p></div></div>
      <div className="bars">{rows.map((row, i) => { const n = metric(row); const lead = (result.leaders ?? []).some((l) => l.id === row.option.id); const all = room.method === 'objections' && n === result.submitted; return <div className={`bar-row ${lead ? 'is-lead' : ''}`} key={row.option.id} style={{ '--i': i } as React.CSSProperties}>
        <span>{row.option.title}</span><div className="bar"><span className={room.method === 'objections' && !all ? 'partial' : ''} style={{ width: `${(n / max) * 100}%` }} /></div><b>{room.method === 'objections' ? `${n} из ${result.submitted} согласны` : n}</b></div> })}</div>
    </section>

    {room.is_host && !canDraw && <div className="row-end"><button className="btn" disabled={!!busy} onClick={() => void act('discuss', () => api.newRound(room.id), (r) => navigate(`/rooms/${r.id}`))}><RotateCcw size={15} />{busy === 'discuss' ? 'Открываем…' : 'Изменить варианты и начать новый раунд'}</button></div>}
  </div>
}
