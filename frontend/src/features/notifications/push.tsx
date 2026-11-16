import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../app/auth'

const DISMISS_KEY = 'veto.pushPromptDismissed'

function b64ToUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.register('/sw.js') } catch { return null }
}

/** Ask for permission only after an explicit user action. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!pushSupported()) return 'unavailable'
  const key = await api.pushKey().catch(() => null)
  if (!key?.available || !key.public_key) return 'unavailable'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker())
  if (!reg) return 'unavailable'
  const existing = await reg.pushManager.getSubscription()
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key.public_key) }))
  await api.pushSubscribe(sub.toJSON())
  return 'granted'
}

export async function disablePush() {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  await api.pushUnsubscribe(sub?.endpoint)
  await sub?.unsubscribe()
}

/** Explains the value first; shown only if push is possible and not yet decided. */
export function PushPrompt({ compact = false }: { compact?: boolean }) {
  const { user, meta, refreshUser } = useAuth()
  const [hidden, setHidden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => {
    const decided = !pushSupported() || Notification.permission !== 'default' || localStorage.getItem(DISMISS_KEY) === '1'
    setHidden(decided || !meta?.features.push || !!user?.notification_prefs.push)
  }, [meta, user])
  if (hidden) return null
  async function enable() {
    setBusy(true)
    const result = await enablePush().catch(() => 'unavailable' as const)
    setBusy(false)
    if (result === 'granted') { await refreshUser(); setHidden(true) }
    else setNote(result === 'denied' ? 'Браузер запретил уведомления. Центр уведомлений в VETO продолжит работать.' : 'Этот браузер не поддерживает push-уведомления.')
  }
  return <div className={`push-prompt ${compact ? 'is-compact' : ''}`}>
    <BellRing size={18} />
    <div><b>Узнавайте о старте голосования и результате сразу</b><span>Только важные события, без рассылок. Отключить можно в настройках.</span>{note && <small>{note}</small>}</div>
    <div className="push-actions">
      <button className="btn small primary" onClick={() => void enable()} disabled={busy}>{busy ? 'Включаем…' : 'Включить'}</button>
      <button className="btn small ghost" onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setHidden(true) }}>Не сейчас</button>
    </div>
  </div>
}
