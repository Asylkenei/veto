import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { ErrorNotice, Skeleton } from '../../components/States'
import { useToast } from '../../components/Toast'
import { api } from '../../lib/api'
import type { Room } from '../decisions/types'
import type { Place } from './types'

export function AddToDecisionModal({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const navigate = useNavigate()
  const toast = useToast()
  useEffect(() => { if (place) api.rooms().then((list) => setRooms(list.filter((r) => ['COLLECTING', 'READY'].includes(r.status) && (r.allow_suggestions || r.is_host)))).catch((e) => setError(e.message)) }, [place])
  async function add(room: Room) {
    if (!place) return
    setBusy(room.id); setError('')
    try { await api.addOption(room.id, { title: place.name, description: place.summary, place_id: place.id }); toast(room.is_host ? `«${place.name}» добавлено в «${room.title}»` : `Предложили «${place.name}» в «${room.title}»`); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось добавить') } finally { setBusy('') }
  }
  return <Modal open={!!place} onClose={onClose} title={`Добавить «${place?.name ?? ''}»`}>
    <button className="pick-row is-new" onClick={() => place && navigate(`/decisions/new?place=${place.id}`)}><Plus size={16} /><span><b>Новое решение</b><small>Место станет первым вариантом</small></span></button>
    {!rooms && !error && <div className="stack-sm"><Skeleton className="line" /><Skeleton className="line" /></div>}
    {rooms && rooms.length > 0 && <p className="muted small">Или в одно из активных решений, где ещё собирают варианты:</p>}
    {rooms?.map((r) => <button key={r.id} className="pick-row" disabled={!!busy} onClick={() => void add(r)}><span><b>{r.title}</b><small>{r.question}</small></span>{busy === r.id && <span className="spinner" />}</button>)}
    {error && <ErrorNotice message={error} />}
  </Modal>
}
