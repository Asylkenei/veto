import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type Toast = { id: number; text: string; tone: 'ok' | 'error' }
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list.slice(-2), { id, text, tone }])
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3600)
  }, [])
  return <ToastContext.Provider value={show}>{children}
    <div className="toast-stack" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>)}</div>
  </ToastContext.Provider>
}
