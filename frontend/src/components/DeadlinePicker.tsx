import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { parseIso, plural } from '../lib/format'

const ITEM = 40
const VISIBLE = 5

/** One iOS-style wheel: scroll-snap list with a 3D drum effect and keyboard support. */
function Wheel({ items, index, onChange, label, width }: { items: string[]; index: number; onChange: (i: number) => void; label: string; width: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef(0)
  const internal = useRef(false)

  const paint = useCallback(() => {
    const el = ref.current
    if (!el) return
    const center = el.scrollTop + (ITEM * VISIBLE) / 2
    el.querySelectorAll<HTMLElement>('.wheel-item').forEach((node, i) => {
      const offset = (i * ITEM + ITEM / 2 + ITEM * 2 - center) / ITEM // in rows from the middle
      const clamped = Math.max(-2.6, Math.min(2.6, offset))
      node.style.transform = `rotateX(${clamped * -22}deg) translateZ(0)`
      node.style.opacity = String(Math.max(0.18, 1 - Math.abs(offset) * 0.32))
      node.classList.toggle('is-center', Math.abs(offset) < 0.5)
    })
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (internal.current) { internal.current = false; return }
    const target = index * ITEM
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target, behavior: el.dataset.ready ? 'smooth' : 'auto' })
    el.dataset.ready = '1'
    paint()
  }, [index, paint])

  function onScroll() {
    paint()
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const next = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM)))
      if (next !== index) { internal.current = true; onChange(next) }
      if (navigator.vibrate && next !== index) navigator.vibrate(4)
    }, 90)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.max(0, Math.min(items.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1))))
    }
  }

  return <div className="wheel" style={{ width }} ref={ref} onScroll={onScroll} tabIndex={0} role="listbox" aria-label={label} aria-activedescendant={`${label}-${index}`} onKeyDown={onKey}>
    <div className="wheel-pad" />
    {items.map((item, i) => <div key={item + i} id={`${label}-${i}`} role="option" aria-selected={i === index} className="wheel-item" onClick={() => onChange(i)}>{item}</div>)}
    <div className="wheel-pad" />
  </div>
}

const pad = (n: number) => String(n).padStart(2, '0')
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function buildDays() {
  const base = new Date(); base.setHours(0, 0, 0, 0)
  return Array.from({ length: 31 }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i)
    const label = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')
    return { date: d, label }
  })
}

function roundedSoon(hours: number) {
  const d = new Date(Date.now() + hours * 3600_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
  return d
}

export function describeUntil(target: Date) {
  const minutes = Math.round((target.getTime() - Date.now()) / 60000)
  if (minutes <= 0) return null
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60
  const parts = [d && plural(d, 'день', 'дня', 'дней'), h && `${h} ч`, m && `${m} мин`].filter(Boolean)
  return parts.slice(0, 2).join(' ')
}

/** Deadline control in the style of the iOS alarm picker. `value` is an ISO string or null. */
export function DeadlinePicker({ value, onChange }: { value: string | null; onChange: (iso: string | null) => void }) {
  const days = useMemo(buildDays, [])
  const [, tick] = useState(0)
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30_000); return () => window.clearInterval(t) }, [])

  const current = value ? parseIso(value) : null
  const dayIndex = current ? Math.max(0, days.findIndex((d) => d.date.toDateString() === current.toDateString())) : 0
  const hourIndex = current ? current.getHours() : 0
  const minuteIndex = current ? Math.round(current.getMinutes() / 5) % 12 : 0

  function set(day: number, hour: number, minute: number) {
    const d = new Date(days[day].date)
    d.setHours(HOURS[hour], MINUTES[minute], 0, 0)
    onChange(d.toISOString())
  }
  const quick = [
    { label: 'Через час', make: () => roundedSoon(1) },
    { label: 'Через 3 часа', make: () => roundedSoon(3) },
    { label: 'Сегодня в 21:00', make: () => { const d = new Date(); d.setHours(21, 0, 0, 0); return d } },
    { label: 'Завтра в 12:00', make: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d } },
  ]

  if (!current) return <div className="deadline is-off">
    <div className="deadline-head"><div><b>Срок голосования</b><small>Без срока — голосование закончится, когда проголосуют все.</small></div>
      <button type="button" role="switch" aria-checked={false} aria-label="Установить срок" className="switch" onClick={() => onChange(roundedSoon(3).toISOString())} /></div>
  </div>

  const until = describeUntil(current)
  return <div className="deadline">
    <div className="deadline-head"><div><b>Срок голосования</b>
      <small className={until ? '' : 'field-error'}>{until ? `Голосование закроется через ${until}` : 'Это время уже прошло — выберите позже'}</small></div>
      <button type="button" role="switch" aria-checked aria-label="Убрать срок" className="switch on" onClick={() => onChange(null)} /></div>
    <div className="wheels" aria-label="Выбор даты и времени">
      <div className="wheel-band" aria-hidden="true" />
      <Wheel label="День" width="46%" items={days.map((d) => d.label)} index={dayIndex} onChange={(i) => set(i, hourIndex, minuteIndex)} />
      <Wheel label="Часы" width="22%" items={HOURS.map(pad)} index={hourIndex} onChange={(i) => set(dayIndex, i, minuteIndex)} />
      <span className="wheel-colon" aria-hidden="true">:</span>
      <Wheel label="Минуты" width="22%" items={MINUTES.map(pad)} index={minuteIndex} onChange={(i) => set(dayIndex, hourIndex, i)} />
    </div>
    <div className="quick-chips">{quick.map((q) => <button type="button" key={q.label} onClick={() => onChange(q.make().toISOString())}>{q.label}</button>)}</div>
  </div>
}
