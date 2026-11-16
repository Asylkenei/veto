import { Check } from 'lucide-react'
import type { Room } from './types'

const stages = [{ key: 'COLLECTING', label: 'Варианты' }, { key: 'READY', label: 'Подготовка' }, { key: 'VOTING', label: 'Голосование' }, { key: 'COMPLETED', label: 'Итог' }]
export function RoomProgress({ room }: { room: Room }) {
  const current = room.status === 'NO_CONSENSUS' ? 3 : room.status === 'CANCELLED' ? 0 : Math.max(0, stages.findIndex((s) => s.key === room.status))
  const done = current === 3
  return <ol className="track" aria-label="Этапы решения">{stages.map((s, i) => <li key={s.key} className={i < current || (done && i === 3) ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
    <span>{i < current || (done && i === 3) ? <Check size={12} /> : i + 1}</span>{s.label}</li>)}</ol>
}
