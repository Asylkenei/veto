import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function AuthLayout({ title, lead, children, footer, aside }: { title: string; lead?: string; children: ReactNode; footer?: ReactNode; aside?: ReactNode }) {
  return <div className="auth">
    <div className="auth-panel">
      <Link to="/" className="brand"><span className="brand-mark">V</span><span className="brand-word">VETO</span></Link>
      <div className="auth-form-wrap">
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
      {footer && <div className="auth-footer">{footer}</div>}
    </div>
    <aside className="auth-aside" aria-hidden="true">{aside ?? <AuthArt />}</aside>
  </div>
}

/** A miniature of what VETO does: several opinions converging into one decision. */
function AuthArt() {
  return <div className="auth-art">
    <p className="auth-quote">Не просто голосуй —<br />договорись.</p>
    <div className="converge">
      {['Кино', 'Боулинг', 'Ужин', 'Квест'].map((t, i) => <span key={t} className={`chip chip-${i}`}>{t}</span>)}
      <span className="converge-result"><i />Боулинг в субботу</span>
    </div>
    <ul className="auth-points">
      <li>Три правила: большинство, единогласие, без возражений</li>
      <li>Результат считает сервер — его видят все одинаково</li>
      <li>Приглашение по ссылке или шестизначному коду</li>
    </ul>
  </div>
}
