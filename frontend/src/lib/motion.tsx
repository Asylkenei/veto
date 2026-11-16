import { useLayoutEffect, useRef } from 'react'

/** iOS sheet curve — used for every interactive motion in VETO. */
export const SPRING = 'cubic-bezier(.32, .72, 0, 1)'
export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * FLIP: when the order of keyed children changes, animate each element from its
 * old position to the new one (like reordering in iOS lists).
 * Elements must carry `data-flip-key`.
 */
export function useFlip(container: React.RefObject<HTMLElement>, deps: unknown[], skipKey?: string | null) {
  const rects = useRef(new Map<string, DOMRect>())
  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-flip-key]'))
    const next = new Map<string, DOMRect>()
    nodes.forEach((node) => {
      const key = node.dataset.flipKey!
      const rect = node.getBoundingClientRect()
      next.set(key, rect)
      const prev = rects.current.get(key)
      if (!prev || reducedMotion() || key === skipKey) return
      const dy = prev.top - rect.top
      if (Math.abs(dy) > 1) node.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 380, easing: SPRING })
    })
    rects.current = next
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Digits roll up when a number grows (vote counters). */
export function RollingNumber({ value }: { value: number }) {
  return <span className="roll" aria-live="polite"><span key={value} className="roll-in">{value}</span></span>
}

/** Checkmark drawn with a stroke — the moment a vote is accepted. */
export function DrawnCheck({ size = 56 }: { size?: number }) {
  return <svg className="drawn-check" width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
    <circle cx="28" cy="28" r="26" className="dc-circle" />
    <path d="M17 29.5 L25 37 L40 20" className="dc-tick" />
  </svg>
}
