import { useEffect, useRef, useState } from 'react'
import type { ResultOption } from './types'

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Purely visual: the server has already chosen `target`. The drum slows down
 * and always lands on it, so every participant sees the same outcome.
 */
export function RandomizerDrum({ candidates, target, play, onDone }: { candidates: ResultOption[]; target: ResultOption; play: boolean; onDone?: () => void }) {
  const [index, setIndex] = useState(play && !reduceMotion() ? 0 : candidates.findIndex((c) => c.id === target.id))
  const [running, setRunning] = useState(play && !reduceMotion())
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (!running) { done.current?.(); return }
    const targetIndex = candidates.findIndex((c) => c.id === target.id)
    const total = candidates.length * 6 + ((targetIndex - 0 + candidates.length) % candidates.length)
    let step = 0
    let timer = 0
    const tick = () => {
      step += 1
      setIndex(step % candidates.length)
      if (step >= total) { setRunning(false); return }
      const progress = step / total
      timer = window.setTimeout(tick, 45 + Math.pow(progress, 3) * 380)
    }
    timer = window.setTimeout(tick, 120)
    return () => window.clearTimeout(timer)
  }, [running, candidates, target.id])
  const progress = running ? 'Выбираем случайно…' : 'Выбор сделан'
  return <div className={`drum ${running ? 'is-running' : 'is-done'}`} role="status" aria-live="polite">
    <div className="drum-window">{candidates.map((c, i) => <div key={c.id} className={`drum-item ${i === index ? 'is-active' : ''}`}>{c.title}</div>)}</div>
    <div className="drum-progress"><span className={running ? 'run' : 'full'} /></div>
    <small>{progress}</small>
  </div>
}
