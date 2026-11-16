import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Check, Clock3, LogOut, MessageCircle, Pencil, Plus, Settings2, Trash2, UserMinus, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { Modal } from '../../components/Modal'
import { ErrorNotice, LoadingState } from '../../components/States'
import { useToast } from '../../components/Toast'
import { api } from '../../lib/api'
import { formatDateTime, people, plural } from '../../lib/format'
import { InvitePanel } from './InvitePanel'
import { ReorderList } from './ReorderList'
import { RoomProgress } from './RoomProgress'
import { RoomSettingsModal } from './RoomSettingsModal'
import { METHODS, STATUS_LABELS, type Option, type Room } from './types'
import { useRoom } from './useRoom'

export function DecisionRoomPage() {
  const { room, setRoom, loading, error, refresh } = useRoom()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rejecting, setRejecting] = useState<Option | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const created = (location.state as { created?: boolean } | null)?.created

  useEffect(() => { if (room && !room.is_member) navigate(`/join/${room.id}`, { replace: true }) }, [room, navigate])

  async function run(action: () => Promise<Room | void>, success?: string) {
    try { const r = await action(); if (r) setRoom(r); if (success) toast(success) }
    catch (e) { toast(e instanceof Error ? e.message : 'Действие не выполнено', 'error') }
  }
  async function addOption(e: FormEvent) {
    e.preventDefault(); if (!room || !title.trim()) return
    setBusy(true); setFormError('')
    try { setRoom(await api.addOption(room.id, { title: title.trim(), description: description.trim() })); setTitle(''); setDescription(''); toast(room.is_host ? 'Вариант добавлен' : 'Предложение отправлено организатору') }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Не удалось добавить вариант') } finally { setBusy(false) }
  }

  if (loading) return <LoadingState label="Загружаем комнату…" />
  if (error || !room) return <div className="page narrow"><Link to="/decisions" className="back-link"><ArrowLeft size={15} />Мои решения</Link><ErrorNotice message={error || 'Комната недоступна'} onRetry={() => void refresh()} /></div>
  if (!room.is_member) return <LoadingState />
  const open = ['COLLECTING', 'READY'].includes(room.status)
  const accepted = room.options.filter((o) => o.status === 'ACCEPTED')
  const pending = room.options.filter((o) => o.status === 'PENDING')
  const round = room.rounds.at(-1)
  return <div className="page">
    <Link to="/decisions" className="back-link"><ArrowLeft size={15} />Мои решения</Link>
    <header className="room-head">
      <div>
        <div className="room-meta"><span className={`status status-${room.status.toLowerCase()}`}>{STATUS_LABELS[room.status]}</span><span>{METHODS[room.method].name}</span><span>Организатор — {room.host_name}</span>{room.deadline && <span><Clock3 size={13} />до {formatDateTime(room.deadline)}</span>}</div>
        <h1>{room.title}</h1>
        <p className="room-question">{room.question}</p>
        {room.description && <p className="muted room-desc">{room.description}</p>}
      </div>
      {room.is_host && open && <button className="btn" onClick={() => setSettingsOpen(true)}><Settings2 size={16} />Настройки</button>}
    </header>
    <RoomProgress room={room} />

    <div className="room-layout">
      <section className="room-main">
        {room.status === 'VOTING' && <Callout to={`/rooms/${room.id}/vote`} cta="Перейти к голосованию">Голосование идёт — проголосовали {round?.ballots.length ?? 0} из {round?.participant_ids.length ?? 0}. Участники и варианты зафиксированы.</Callout>}
        {['COMPLETED', 'NO_CONSENSUS'].includes(room.status) && <Callout to={`/rooms/${room.id}/results`} cta="Посмотреть итог">Голосование завершено.</Callout>}

        <section className="card">
          <div className="section-head"><div><h2>Варианты</h2><p className="muted">{plural(accepted.length, 'принят', 'принято', 'принято')}{pending.length ? ` · ${pending.length} на рассмотрении` : ''}</p></div>
            {room.is_host && open && <Link className="btn primary small" to={`/rooms/${room.id}/prepare`}>Подготовить голосование</Link>}</div>
          {!room.options.length && <div className="inline-empty"><b>Пока нет вариантов</b><p>Предложите первую идею — группе нужно из чего выбирать.</p></div>}
          {room.is_host && open && room.options.length > 1 && <p className="muted small reorder-hint">Перетащите варианты за ручку — в таком порядке их увидят участники при голосовании.</p>}
          <ReorderList items={room.options} enabled={room.is_host && open && room.options.length > 1}
            onCommit={async (ids) => { setRoom(await api.reorderOptions(room.id, ids)) }}
            render={(o, handle) => <OptionCard room={room} option={o} handle={handle} onReject={() => setRejecting(o)} run={run} />} />
          {open && (room.allow_suggestions || room.is_host) && <form className="add-option" onSubmit={addOption}>
            <h3>Добавить вариант</h3>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название варианта" maxLength={180} aria-label="Название варианта" />
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Короткое пояснение — необязательно" rows={2} maxLength={3000} aria-label="Пояснение" />
            {formError && <ErrorNotice message={formError} />}
            <div className="row-between"><small className="muted">{room.is_host ? 'Ваши варианты принимаются сразу.' : 'Организатор рассмотрит предложение.'} <Link to="/explore" className="link">Идеи в «Интересном»</Link></small><button className="btn" disabled={busy || !title.trim()}><Plus size={15} />{busy ? 'Отправляем…' : room.is_host ? 'Добавить' : 'Предложить'}</button></div>
          </form>}
        </section>
      </section>

      <aside className="room-aside">
        <InvitePanel room={room} highlight={!!created && room.participant_count < 2} />
        <section className="card aside-card">
          <div className="section-head"><h3>Участники</h3><span className="muted">{people(room.participant_count)}</span></div>
          <ul className="people">{room.participants.map((p) => <li key={p.id}><Avatar name={p.display_name} color={p.avatar_color} size="sm" /><span>{p.display_name}{p.id === room.current_user_id && <em> (вы)</em>}</span>
            {p.role === 'HOST' ? <small className="tag">Организатор</small> : room.is_host && open && <button className="icon-btn small" aria-label={`Удалить ${p.display_name}`} onClick={() => void run(() => api.removeParticipant(room.id, p.id), 'Участник удалён')}><UserMinus size={14} /></button>}</li>)}</ul>
          {!room.is_host && open && <button className="btn ghost full" onClick={() => setConfirmLeave(true)}><LogOut size={15} />Покинуть решение</button>}
        </section>
        <section className="card aside-card"><h3>Правило</h3><p className="rule"><span><b>{METHODS[room.method].name}.</b> {METHODS[room.method].detail}</span></p></section>
      </aside>
    </div>

    {room.is_host && <RoomSettingsModal key={room.version} room={room} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={(r) => { setRoom(r); toast('Настройки сохранены') }} />}
    <RejectModal option={rejecting} onClose={() => setRejecting(null)} onSubmit={(reason) => rejecting && run(() => api.moderateOption(room.id, rejecting.id, { status: 'REJECTED', rejection_reason: reason }), 'Вариант отклонён').then(() => setRejecting(null))} />
    <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Покинуть решение?">
      <p>Вы больше не будете участвовать в этом решении. Ваши варианты останутся в списке. Вернуться можно по ссылке-приглашению, пока не началось голосование.</p>
      <div className="modal-actions"><button className="btn" onClick={() => setConfirmLeave(false)}>Остаться</button><button className="btn danger" onClick={() => void run(async () => { await api.leave(room.id); navigate('/decisions') }, 'Вы покинули решение')}>Покинуть</button></div>
    </Modal>
  </div>
}

function Callout({ children, to, cta }: { children: React.ReactNode; to: string; cta: string }) {
  return <div className="callout"><span>{children}</span><Link className="btn primary small" to={to}>{cta}</Link></div>
}

function OptionCard({ room, option, handle, onReject, run }: { room: Room; option: Option; handle: React.ReactNode; onReject: () => void; run: (a: () => Promise<Room | void>, s?: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(option.title)
  const [description, setDescription] = useState(option.description)
  const [comment, setComment] = useState('')
  const [showComments, setShowComments] = useState(false)
  const open = ['COLLECTING', 'READY'].includes(room.status)
  const comments = room.comments.filter((c) => c.option_id === option.id)
  const statusLabel = option.status === 'ACCEPTED' ? 'Принят' : option.status === 'REJECTED' ? 'Отклонён' : 'На рассмотрении'
  if (editing) return <article className="option is-editing">
    <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} aria-label="Название" autoFocus />
    <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} aria-label="Пояснение" />
    <div className="row-end"><button className="btn small" onClick={() => setEditing(false)}>Отмена</button><button className="btn small primary" disabled={!title.trim()} onClick={() => void run(() => api.editOption(room.id, option.id, { title: title.trim(), description: description.trim() }), 'Вариант обновлён').then(() => setEditing(false))}>Сохранить</button></div>
  </article>
  return <article className={`option option-${option.status.toLowerCase()}`}>
    <div className="option-head">
      {handle}
      {option.image_url && <img className="option-thumb" src={option.image_url} alt="" title={option.image_credit} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
      <div className="option-title"><h3>{option.title}</h3><small className="muted">Предложил(а) {option.author}</small></div>
      <div className="option-tools">
        <span className={`status status-${option.status.toLowerCase()}`}>{statusLabel}</span>
        {option.can_edit && open && <><button className="icon-btn small" aria-label="Изменить вариант" onClick={() => setEditing(true)}><Pencil size={14} /></button>
          <button className="icon-btn small" aria-label="Удалить вариант" onClick={() => { if (window.confirm(`Удалить «${option.title}»?`)) void run(() => api.deleteOption(room.id, option.id), 'Вариант удалён') }}><Trash2 size={14} /></button></>}
      </div>
    </div>
    {option.description && <p>{option.description}</p>}
    {option.status === 'REJECTED' && option.rejection_reason && <p className="reject-reason">Причина: {option.rejection_reason}</p>}
    {room.is_host && option.status === 'PENDING' && open && <div className="row-start">
      <button className="btn small primary" onClick={() => void run(() => api.moderateOption(room.id, option.id, { status: 'ACCEPTED', rejection_reason: '' }), 'Вариант принят')}><Check size={14} />Принять</button>
      <button className="btn small ghost" onClick={onReject}><X size={14} />Отклонить</button></div>}
    {room.allow_comments && open && <div className="comments">
      <button className="text-button" onClick={() => setShowComments(!showComments)} aria-expanded={showComments}><MessageCircle size={14} />{comments.length ? plural(comments.length, 'комментарий', 'комментария', 'комментариев') : 'Обсудить'}</button>
      {showComments && <>{comments.map((c) => <div className="comment" key={c.id}><b>{c.author}</b><span>{c.text}</span></div>)}
        <form className="comment-form" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) void run(() => api.comment(room.id, option.id, comment.trim())).then(() => setComment('')) }}>
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ваш комментарий" maxLength={2000} aria-label="Комментарий" />
          <button className="btn small" disabled={!comment.trim()}>Отправить</button></form></>}
    </div>}
  </article>
}

function RejectModal({ option, onClose, onSubmit }: { option: Option | null; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return <Modal open={!!option} onClose={onClose} title="Отклонить вариант">
    <p>Почему «{option?.title}» не подходит? Автор увидит причину.</p>
    <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: не подходит по бюджету" maxLength={1000} autoFocus />
    <div className="modal-actions"><button className="btn" onClick={onClose}>Отмена</button><button className="btn danger" onClick={() => { onSubmit(reason.trim()); setReason('') }}>Отклонить</button></div>
  </Modal>
}
