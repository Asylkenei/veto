import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Bug, ChevronDown, Lightbulb, Mail, MessageSquareText, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/auth'
import { ErrorNotice, SuccessNotice } from '../../components/States'
import { api } from '../../lib/api'
import { FAQ, FAQ_CATEGORIES } from './faq'

export function HelpPage({ publicView = false }: { publicView?: boolean }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const list = useMemo(() => FAQ.map((f, i) => ({ ...f, i })).filter((f) => (!cat || f.c === cat) && (!q.trim() || `${f.q} ${f.a}`.toLowerCase().includes(q.trim().toLowerCase()))), [q, cat])
  return <div className={`page ${publicView ? 'public-page' : ''}`}>
    {publicView && <Link to="/login" className="back-link">← Ко входу</Link>}
    <div className="page-head"><div><h1>Помощь и поддержка</h1><p className="lead">Ответы на частые вопросы и связь с командой VETO.</p></div></div>
    <div className="help-layout">
      <section>
        <label className="search large"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по вопросам" aria-label="Поиск по вопросам" /></label>
        <div className="chips"><button className={!cat ? 'active' : ''} onClick={() => setCat('')}>Все</button>{FAQ_CATEGORIES.map((c) => <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
        <div className="card faq">{list.length ? list.map((f) => <div key={f.i} className={`faq-item ${open === f.i ? 'is-open' : ''}`}>
          <button onClick={() => setOpen(open === f.i ? null : f.i)} aria-expanded={open === f.i}><span>{f.q}</span><ChevronDown size={17} /></button>
          {open === f.i && <p>{f.a}</p>}</div>) : <p className="pad muted">Ничего не нашлось. Напишите нам — ответим лично.</p>}</div>
      </section>
      <SupportForm />
    </div>
  </div>
}

const KINDS = [{ id: 'question', name: 'Вопрос', icon: MessageSquareText }, { id: 'bug', name: 'Ошибка', icon: Bug }, { id: 'idea', name: 'Идея', icon: Lightbulb }] as const

function SupportForm() {
  const { user, meta } = useAuth()
  const [kind, setKind] = useState<string>('question')
  const [category, setCategory] = useState('other')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState(user?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { const r = await api.supportTicket({ kind, category, subject: subject.trim(), message: message.trim(), contact: contact.trim() }); setSent(r.id); setSubject(''); setMessage('') }
    catch (err) { setError(err instanceof Error ? err.message : 'Не удалось отправить обращение') } finally { setBusy(false) }
  }
  return <aside className="card support" id="contact">
    <h2>Написать в поддержку</h2>
    {sent ? <><SuccessNotice message={`Обращение отправлено. Номер: ${sent.slice(0, 8)}. Ответим${contact ? ` на ${contact}` : ''}.`} /><button className="btn full" onClick={() => setSent('')}>Новое обращение</button></> :
      <form className="form" onSubmit={submit}>
        <div className="segmented">{KINDS.map((k) => <button type="button" key={k.id} className={kind === k.id ? 'active' : ''} onClick={() => setKind(k.id)}><k.icon size={15} />{k.name}</button>)}</div>
        <label className="field"><span>Категория</span><select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{FAQ_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="other">Другое</option></select></label>
        <label className="field"><span>Тема</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} minLength={3} maxLength={200} required /></label>
        <label className="field"><span>Описание</span><textarea className="input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} minLength={10} maxLength={5000} required placeholder={kind === 'bug' ? 'Что вы делали, что ожидали и что произошло?' : ''} /></label>
        <label className="field"><span>Контакт для ответа</span><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email или Telegram" maxLength={254} /></label>
        {error && <ErrorNotice message={error} />}
        <button className="btn primary full" disabled={busy || subject.trim().length < 3 || message.trim().length < 10}>{busy ? 'Отправляем…' : 'Отправить обращение'}</button>
      </form>}
    {meta?.support_email && <p className="muted small support-mail"><Mail size={14} />{meta.support_email}</p>}
  </aside>
}
