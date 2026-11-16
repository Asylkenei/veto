import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../app/auth'
import { ErrorNotice } from '../../components/States'
import { AuthLayout } from './AuthLayout'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [shown, setShown] = useState(false)
  return <div className="input-affix">
    <input id={id} className={`input ${invalid ? 'is-invalid' : ''}`} type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
    <button type="button" className="affix-btn" onClick={() => setShown(!shown)} aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}>{shown ? <EyeOff size={17} /> : <Eye size={17} />}</button>
  </div>
}

export function passwordStrength(pw: string) {
  const checks = [
    { ok: pw.length >= 8, label: '8+ символов' },
    { ok: /\d/.test(pw), label: 'цифра' },
    { ok: /[a-zа-яё]/i.test(pw), label: 'буква' },
  ]
  const bonus = (pw.length >= 12 ? 1 : 0) + (/[^\w\s]/.test(pw) || /[A-ZА-ЯЁ]/.test(pw) ? 1 : 0)
  const score = checks.filter((c) => c.ok).length + (checks.every((c) => c.ok) ? bonus : 0)
  return { checks, valid: checks.every((c) => c.ok), level: score <= 2 ? 'weak' : score <= 3 ? 'fair' : 'strong' }
}

export function StrengthMeter({ password }: { password: string }) {
  const s = passwordStrength(password)
  if (!password) return null
  return <div className={`strength strength-${s.level}`}>
    <div className="strength-bar"><span /><span /><span /></div>
    <small>{s.level === 'weak' ? 'Слабый пароль' : s.level === 'fair' ? 'Нормальный пароль' : 'Надёжный пароль'} · {s.checks.map((c) => <em key={c.label} className={c.ok ? 'ok' : ''}>{c.label}</em>)}</small>
  </div>
}

export function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) { setError('Укажите корректный email'); return }
    setBusy(true); setError('')
    try { const r = await api.login({ email: email.trim(), password, remember }); setUser(r.user); navigate(next, { replace: true }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Не удалось войти') }
    finally { setBusy(false) }
  }
  const nextQuery = next !== '/' ? `?next=${encodeURIComponent(next)}` : ''
  return <AuthLayout title="Вход в VETO" lead={next.startsWith('/join/') ? 'Войдите, чтобы присоединиться к решению по приглашению.' : 'Продолжите решения, которые вы начали с друзьями и коллегами.'}
    footer={<>Нет аккаунта? <Link to={`/register${nextQuery}`}>Зарегистрироваться</Link></>}>
    <form className="form" onSubmit={submit} noValidate>
      <label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required /></label>
      <label className="field" htmlFor="password"><span className="field-row">Пароль<Link to="/forgot-password" className="field-link">Забыли пароль?</Link></span>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" /></label>
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Запомнить меня на этом устройстве</span></label>
      {error && <ErrorNotice message={error} />}
      <button className="btn primary full large" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
      {next.startsWith('/join/') && <Link to={next} className="btn ghost full">Продолжить без аккаунта</Link>}
    </form>
  </AuthLayout>
}

export function RegisterPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [name, setName] = useState(user?.display_name ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const strength = passwordStrength(password)
  const problems = useMemo(() => ({
    name: !name.trim() ? 'Укажите имя' : '',
    email: !EMAIL_RE.test(email.trim()) ? 'Укажите корректный email' : '',
    password: !strength.valid ? 'Пароль слишком простой' : '',
    confirm: confirm !== password ? 'Пароли не совпадают' : '',
  }), [name, email, password, confirm, strength.valid])
  async function submit(e: FormEvent) {
    e.preventDefault(); setTouched(true)
    if (Object.values(problems).some(Boolean)) return
    setBusy(true); setError('')
    try {
      const r = await api.register({ display_name: name.trim(), email: email.trim(), password, remember: true })
      setDone(true); setUser(r.user)
      timer.current = window.setTimeout(() => navigate(next, { replace: true }), 900)
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться') }
    finally { setBusy(false) }
  }
  if (!done && user && !user.is_guest) return <Navigate to={next} replace />
  if (done) return <AuthLayout title="Аккаунт создан" lead="Перенаправляем вас дальше…"><div className="success-check" aria-hidden="true" /></AuthLayout>
  const nextQuery = next !== '/' ? `?next=${encodeURIComponent(next)}` : ''
  const err = (k: keyof typeof problems) => touched && problems[k] ? <small className="field-error">{problems[k]}</small> : null
  return <AuthLayout title={user?.is_guest ? 'Сохраните свой профиль' : 'Создайте аккаунт'}
    lead={user?.is_guest ? 'Добавьте email и пароль — все ваши решения и голоса останутся с вами.' : 'Решения и история будут доступны с любого устройства.'}
    footer={<>Уже есть аккаунт? <Link to={`/login${nextQuery}`}>Войти</Link></>}>
    <form className="form" onSubmit={submit} noValidate>
      <label className="field"><span>Имя</span><input className={`input ${touched && problems.name ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" autoFocus />{err('name')}</label>
      <label className="field"><span>Email</span><input className={`input ${touched && problems.email ? 'is-invalid' : ''}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />{err('email')}</label>
      <label className="field" htmlFor="new-password"><span>Пароль</span><PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" invalid={touched && !!problems.password} /><StrengthMeter password={password} />{err('password')}</label>
      <label className="field" htmlFor="confirm-password"><span>Повторите пароль</span><PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={touched && !!problems.confirm} />{err('confirm')}</label>
      {error && <ErrorNotice message={error} />}
      <button className="btn primary full large" disabled={busy}>{busy ? 'Создаём аккаунт…' : user?.is_guest ? 'Сохранить аккаунт' : 'Зарегистрироваться'}</button>
    </form>
  </AuthLayout>
}
