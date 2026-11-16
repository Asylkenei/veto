import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellOff } from 'lucide-react'
import { api, type AppNotification } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import { Skeleton } from '../../components/States'
import { PushPrompt } from './push'

export function NotificationItem({ item, onOpen }: { item: AppNotification; onOpen: (n: AppNotification) => void }) {
  return <button className={`notif ${item.read ? '' : 'is-unread'}`} onClick={() => onOpen(item)}>
    <span className="notif-dot" aria-hidden="true" />
    <span className="notif-copy"><b>{item.title}</b>{item.body && <span>{item.body}</span>}<small>{timeAgo(item.created_at)}</small></span>
  </button>
}

export function NotificationsPanel({ onUnread, onClose }: { onUnread: (n: number) => void; onClose: () => void }) {
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  useEffect(() => { api.notifications().then((r) => { setItems(r.items.slice(0, 8)); onUnread(r.unread) }).catch((e) => setError(e.message)) }, [onUnread])
  async function open(n: AppNotification) {
    if (!n.read) { const r = await api.markRead([n.id]).catch(() => null); if (r) onUnread(r.unread) }
    onClose()
    if (n.link) navigate(n.link)
  }
  async function readAll() { const r = await api.markRead(); onUnread(r.unread); setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null) }
  return <div className="dropdown notif-dropdown" role="dialog" aria-label="Уведомления">
    <div className="dropdown-title"><b>Уведомления</b>{items?.some((n) => !n.read) && <button className="text-button" onClick={() => void readAll()}>Прочитать все</button>}</div>
    {error && <p className="muted pad">{error}</p>}
    {!items && !error && <div className="pad stack-sm"><Skeleton className="line" /><Skeleton className="line" /></div>}
    {items && !items.length && <div className="notif-empty"><BellOff size={20} /><p>Здесь появятся приглашения, старт голосования и результаты.</p></div>}
    {items && items.map((n) => <NotificationItem key={n.id} item={n} onOpen={(x) => void open(x)} />)}
    <PushPrompt compact />
    <Link className="dropdown-footer" to="/notifications" onClick={onClose}>Все уведомления</Link>
  </div>
}
