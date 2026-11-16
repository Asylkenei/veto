import { AlertCircle, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export function LoadingState({ label = 'Загружаем…' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" /><span>{label}</span></div>
}
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="notice notice-error" role="alert"><AlertCircle size={17} /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Повторить</button>}</div>
}
export function SuccessNotice({ message }: { message: string }) {
  return <div className="notice notice-success" role="status">{message}</div>
}
export function InlineFeedback({ error, success }: { error?: string; success?: string }) {
  if (error) return <ErrorNotice message={error} />
  if (success) return <SuccessNotice message={success} />
  return null
}
export function EmptyState({ title, description, cta = 'Создать решение', to = '/decisions/new', icon, action }: { title: string; description: string; cta?: string; to?: string; icon?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state">
    <div className="empty-art" aria-hidden="true">{icon ?? <span className="empty-mark">V</span>}</div>
    <h2>{title}</h2><p>{description}</p>
    {action ?? (cta && <Link className="btn primary" to={to}><Plus size={16} />{cta}</Link>)}
  </div>
}
export function Skeleton({ className = '' }: { className?: string }) { return <span className={`skeleton ${className}`} aria-hidden="true" /> }
