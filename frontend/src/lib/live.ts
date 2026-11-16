import { useEffect, useRef } from 'react'

/** Subscribe to a Server-Sent Events stream; reconnects automatically (browser default). */
export function useEventStream(url: string | null, handlers: Record<string, (data: any) => void>) {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    if (!url || typeof EventSource === 'undefined') return
    const source = new EventSource(url, { withCredentials: true })
    const names = Object.keys(ref.current)
    const listeners = names.map((name) => {
      const fn = (e: MessageEvent) => { try { ref.current[name]?.(JSON.parse(e.data)) } catch { /* ignore malformed */ } }
      source.addEventListener(name, fn as EventListener)
      return [name, fn] as const
    })
    return () => { listeners.forEach(([n, fn]) => source.removeEventListener(n, fn as EventListener)); source.close() }
  }, [url])
}
