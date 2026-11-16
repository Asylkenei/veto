import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GripVertical } from 'lucide-react'
import { useFlip } from '../../lib/motion'

/**
 * Drag to reorder with mouse or finger (pointer events), arrows on the keyboard.
 * The list rearranges live while dragging; `onCommit` is called once on release.
 */
export function ReorderList<T extends { id: string }>({ items, enabled, onCommit, render }: {
  items: T[]; enabled: boolean; onCommit: (ids: string[]) => Promise<void>; render: (item: T, handle: ReactNode) => ReactNode
}) {
  const [order, setOrder] = useState(items.map((i) => i.id))
  const [dragId, setDragId] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const start = useRef<string[]>([])
  const key = items.map((i) => i.id).join(',')
  useEffect(() => { if (!dragId) setOrder(items.map((i) => i.id)) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useFlip(list, [order.join(',')], dragId)
  const byId = new Map(items.map((i) => [i.id, i]))
  const visible = order.map((id) => byId.get(id)).filter(Boolean) as T[]

  function moveTo(id: string, y: number) {
    const nodes = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-flip-key]') ?? []).filter((n) => n.dataset.flipKey !== id)
    let index = nodes.findIndex((n) => { const r = n.getBoundingClientRect(); return y < r.top + r.height / 2 })
    if (index < 0) index = nodes.length
    const rest = order.filter((x) => x !== id)
    const next = [...rest.slice(0, index), id, ...rest.slice(index)]
    if (next.join() !== order.join()) setOrder(next)
  }
  async function finish(next: string[]) {
    setDragId(null)
    if (next.join() === start.current.join()) return
    try { await onCommit(next) } catch { setOrder(start.current) }
  }
  function handle(id: string) {
    if (!enabled) return null
    return <button type="button" className="grip" aria-label="Перетащите, чтобы изменить порядок. Стрелки вверх и вниз тоже работают"
      onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); start.current = order; setDragId(id) }}
      onPointerMove={(e) => { if (dragId === id) moveTo(id, e.clientY) }}
      onPointerUp={() => { if (dragId === id) void finish(order) }}
      onPointerCancel={() => { setOrder(start.current); setDragId(null) }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        const i = order.indexOf(id), j = i + (e.key === 'ArrowUp' ? -1 : 1)
        if (j < 0 || j >= order.length) return
        const next = [...order]; [next[i], next[j]] = [next[j], next[i]]
        start.current = order; setOrder(next); void finish(next)
      }}><GripVertical size={16} /></button>
  }
  return <div className={`option-list ${dragId ? 'is-sorting' : ''}`} ref={list}>
    {visible.map((item) => <div key={item.id} data-flip-key={item.id} className={`reorder-item ${dragId === item.id ? 'is-dragging' : ''}`}>{render(item, handle(item.id))}</div>)}
  </div>
}
