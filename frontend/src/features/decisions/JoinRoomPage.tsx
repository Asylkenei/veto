import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, KeyRound, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { Avatar } from '../../components/Avatar'
import { ErrorNotice, LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { people } from '../../lib/format'
import { AuthLayout } from '../auth/AuthLayout'
import { METHODS, STATUS_LABELS, type Room } from './types'

/** Invite flow. The room id lives in the URL, so it survives login, registration and guest entry. */
export function JoinRoomPage() {
  const { roomId } = useParams()
  const { user } = useAuth()
  if (!roomId) return <EnterCode />
  if (!user) return <InviteGate roomId={roomId} />
  return <InvitePreview roomId={roomId} />
}

function InviteGate({ roomId }: { roomId: string }) {
  const { setUser } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const next = encodeURIComponent(`/join/${roomId}`)
  async function asGuest(e: FormEvent) {
    e.preventDefault(); if (!name.trim()) return
    setBusy(true); setError('')
    try { const r = await api.guest(name.trim()); setUser(r.user) } catch (err) { setError(err instanceof Error ? err.message : 'Не получилось') } finally { setBusy(false) }
  }
  return <AuthLayout title="Вас пригласили в решение" lead="Войдите в аккаунт или просто укажите имя — так вас увидят остальные участники."
    footer={<>Уже есть аккаунт? <Link to={`/login?next=${next}`}>Войти</Link> · <Link to={`/register?next=${next}`}>Создать аккаунт</Link></>}>
    <form className="form" onSubmit={asGuest}>
      <label className="field"><span>Как вас называть?</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ваше имя" autoFocus required /></label>
      {error && <ErrorNotice message={error} />}
      <button className="btn primary full large" disabled={busy || !name.trim()}>{busy ? 'Открываем приглашение…' : 'Продолжить как гость'}</button>
      <small className="muted">Гостевой профиль можно позже сохранить, добавив email и пароль, — решения останутся с вами.</small>
    </form>
  </AuthLayout>
}

function InvitePreview({ roomId }: { roomId: string }) {
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { const r = await api.room(roomId); if (r.is_member) navigate(`/rooms/${r.id}`, { replace: true }); else setRoom(r) }
    catch (e) { setError(e instanceof Error ? e.message : 'Приглашение недоступно') }
  }, [roomId, navigate])
  useEffect(() => { void load() }, [load])
  async function join() {
    if (!room) return
    setBusy(true); setError('')
    try { await api.join(room.id); navigate(`/rooms/${room.id}`, { replace: true }) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось присоединиться') } finally { setBusy(false) }
  }
  if (error && !room) return <div className="page narrow"><ErrorNotice message={error} /><Link className="btn" to="/join">Ввести другой код</Link></div>
  if (!room) return <LoadingState label="Проверяем приглашение…" />
  const closed = !['COLLECTING', 'READY'].includes(room.status)
  return <div className="page narrow">
    <section className="card invite-card">
      <div className="invite-host"><Avatar name={room.host_name} size="lg" /><div><small className="muted">{room.host_name} приглашает вас решить вместе</small><h1>{room.title}</h1></div></div>
      <p className="room-question">{room.question}</p>
      {room.description && <p className="muted">{room.description}</p>}
      <div className="invite-facts"><span><Users size={15} />{people(room.participant_count)}</span><span>{METHODS[room.method].name}</span><span className={`status status-${room.status.toLowerCase()}`}>{STATUS_LABELS[room.status]}</span></div>
      <p className="rule"><span><b>Как принимается решение.</b> {METHODS[room.method].detail}</span></p>
      {error && <ErrorNotice message={error} />}
      <button className="btn primary full large" onClick={() => void join()} disabled={busy || closed}>{busy ? 'Подключаем…' : closed ? 'Приём участников завершён' : 'Присоединиться'}</button>
      {closed && <small className="muted">Голосование уже началось или завершилось — состав участников зафиксирован.</small>}
    </section>
  </div>
}

function EnterCode() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('')
    const v = value.trim()
    if (v.includes('/join/')) { const id = v.split('/join/').pop()?.split(/[?#/]/)[0]; if (id) navigate(`/join/${id}`); return }
    if (/^[a-z0-9]{6}$/i.test(v)) {
      setBusy(true)
      try { const r = await api.roomByCode(v); navigate(`/join/${r.room_id}`) } catch (err) { setError(err instanceof Error ? err.message : 'Код не найден') } finally { setBusy(false) }
      return
    }
    if (/^[0-9a-f-]{36}$/i.test(v)) { navigate(`/join/${v}`); return }
    setError('Введите шестизначный код или вставьте ссылку-приглашение')
  }
  return <div className="page narrow">
    <Link to="/" className="back-link"><ArrowLeft size={15} />На главную</Link>
    <h1>Присоединиться к решению</h1>
    <p className="lead">Введите код из шести символов или вставьте ссылку, которую вам прислали.</p>
    <form className="card code-form" onSubmit={submit}>
      <label className="field"><span>Код или ссылка</span><div className="input-affix"><KeyRound size={16} className="affix-icon" /><input className="input with-icon code-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Например, K7Q2MX" autoFocus required autoCapitalize="characters" /></div></label>
      {error && <ErrorNotice message={error} />}
      <button className="btn primary large" disabled={busy}>{busy ? 'Ищем…' : 'Открыть приглашение'}</button>
    </form>
  </div>
}
