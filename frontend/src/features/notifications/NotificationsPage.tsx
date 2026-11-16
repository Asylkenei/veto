import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOff } from 'lucide-react'
import { api, type AppNotification } from '../../lib/api'
import { EmptyState, ErrorNotice, Skeleton } from '../../components/States'
import { NotificationItem } from './NotificationsPanel'
import { PushPrompt } from './push'

export function NotificationsPage({ onUnread }: { onUnread: (n: number) => void }) {
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const load = () => api.notifications().then((r) => { setItems(r.items); onUnread(r.unread) }).catch((e) => setError(e.message))
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function open(n: AppNotification) {
    if (!n.read) { const r = await api.markRead([n.id]); onUnread(r.unread) }
    if (n.link) navigate(n.link)
  }
  return <div className="page narrow">
    <div className="page-head"><div><h1>Уведомления</h1><p className="lead">Приглашения, старт голосования, напоминания о сроке и результаты.</p></div>
      {items?.some((n) => !n.read) && <button className="btn" onClick={async () => { const r = await api.markRead(); onUnread(r.unread); void load() }}>Прочитать все</button>}</div>
    <PushPrompt />
    {error && <ErrorNotice message={error} onRetry={() => void load()} />}
    {!items && !error && <div className="card stack-sm pad"><Skeleton className="line" /><Skeleton className="line" /><Skeleton className="line" /></div>}
    {items && !items.length && <EmptyState icon={<BellOff size={22} />} title="Пока тихо" description="Когда вас пригласят в решение или голосование завершится, сообщение появится здесь." cta="" />}
    {items && !!items.length && <div className="card notif-list">{items.map((n) => <NotificationItem key={n.id} item={n} onOpen={(x) => void open(x)} />)}</div>}
  </div>
}
