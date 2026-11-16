import { useState } from 'react'
import type { FormEvent } from 'react'
import { Copy, Mail, Share2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useToast } from '../../components/Toast'
import type { Room } from './types'

export function InvitePanel({ room, highlight = false }: { room: Room; highlight?: boolean }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const link = `${location.origin}/join/${room.id}`
  const open = ['COLLECTING', 'READY'].includes(room.status)
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); toast(`${label} скопирован${label === 'Код' ? '' : 'а'}`) } catch { window.prompt('Скопируйте', text) }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: room.title, text: `Помоги решить: ${room.question}`, url: link }) } catch { /* cancelled */ } }
    else void copy(link, 'Ссылка')
  }
  async function invite(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { const r = await api.inviteByEmail(room.id, email.trim()); toast(`${r.display_name} получит приглашение`); setEmail('') }
    catch (err) { setError(err instanceof Error ? err.message : 'Не удалось пригласить') } finally { setBusy(false) }
  }
  if (!open) return null
  return <section className={`card aside-card invite ${highlight ? 'is-highlight' : ''}`}>
    <h3>Пригласить участников</h3>
    {highlight && <p className="muted">Решение создано. Отправьте ссылку тем, с кем договариваетесь.</p>}
    <div className="invite-code"><span className="muted">Код комнаты</span><button className="code" onClick={() => void copy(room.invite_code ?? '', 'Код')} aria-label="Скопировать код">{room.invite_code}</button></div>
    <div className="invite-actions">
      <button className="btn primary" onClick={() => void share()}><Share2 size={15} />Поделиться</button>
      <button className="btn" onClick={() => void copy(link, 'Ссылка')}><Copy size={15} />Ссылка</button>
    </div>
    <form className="invite-email" onSubmit={invite}>
      <label className="sr-only" htmlFor="invite-email">Email участника</label>
      <div className="input-affix"><Mail size={15} className="affix-icon" /><input id="invite-email" className="input with-icon" type="email" placeholder="Email пользователя VETO" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <button className="btn small" disabled={busy || !email.trim()}>{busy ? '…' : 'Пригласить'}</button>
    </form>
    {error && <small className="field-error">{error}</small>}
  </section>
}
