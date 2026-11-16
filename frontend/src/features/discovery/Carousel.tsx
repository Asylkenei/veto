import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Manual horizontal carousel: scroll-snap + swipe, arrows on desktop, no autoplay. */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  const update = () => {
    const el = track.current
    if (!el) return
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 })
  }
  useEffect(() => { update(); const el = track.current; el?.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update); return () => { el?.removeEventListener('scroll', update); window.removeEventListener('resize', update) } }, [children])
  const move = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' })
  return <div className="carousel" role="region" aria-label={label}>
    <button className="carousel-arrow prev" onClick={() => move(-1)} disabled={edges.start} aria-label="Назад"><ChevronLeft size={18} /></button>
    <div className="carousel-track" ref={track} tabIndex={0}>{children}</div>
    <button className="carousel-arrow next" onClick={() => move(1)} disabled={edges.end} aria-label="Вперёд"><ChevronRight size={18} /></button>
  </div>
}
