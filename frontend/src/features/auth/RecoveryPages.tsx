import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { ErrorNotice, LoadingState, SuccessNotice } from '../../components/States'
import { AuthLayout } from './AuthLayout'
import { PasswordInput, passwordStrength, StrengthMeter } from './AuthPages'

export function ForgotPasswordPage() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [supportEmail, setSupportEmail] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.recovery().then((r) => { setAvailable(r.available); setSupportEmail(r.support_email) }).catch(() => setAvailable(false)) }, [])
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await api.recoveryRequest(email.trim()); setSent(true) } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось отправить') } finally { setBusy(false) }
  }
  if (available === null) return <LoadingState />
  return <AuthLayout title="Восстановление доступа" footer={<Link to="/login">Вернуться ко входу</Link>}
    lead={available ? 'Пришлём ссылку для нового пароля на ваш email.' : 'На этом сервере не настроена отправка писем, поэтому восстановить пароль по email нельзя.'}>
    {available ? (sent ? <SuccessNotice message="Если такой аккаунт есть, письмо со ссылкой уже в пути. Проверьте почту и папку «Спам»." /> :
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        {error && <ErrorNotice message={error} />}
        <button className="btn primary full large" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить ссылку'}</button>
      </form>) :
      <div className="stack">
        <p>Напишите нам — поможем вернуть доступ вручную, после проверки, что аккаунт ваш.</p>
        <Link className="btn primary full" to="/help#contact">Написать в поддержку</Link>
        {supportEmail && <p className="muted">Или на почту <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>}
      </div>}
  </AuthLayout>
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const token = params.get('token') || ''
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!passwordStrength(password).valid) { setError('Пароль слишком простой'); return }
    setBusy(true); setError('')
    try { await api.recoveryConfirm(token, password); navigate('/login', { replace: true }) } catch (err) { setError(err instanceof Error ? err.message : 'Ссылка недействительна') } finally { setBusy(false) }
  }
  return <AuthLayout title="Новый пароль" lead="После сохранения войдите с новым паролем." footer={<Link to="/login">Вернуться ко входу</Link>}>
    <form className="form" onSubmit={submit}>
      <label className="field" htmlFor="np"><span>Новый пароль</span><PasswordInput id="np" value={password} onChange={setPassword} autoComplete="new-password" /><StrengthMeter password={password} /></label>
      {error && <ErrorNotice message={error} />}
      <button className="btn primary full large" disabled={busy || !token}>{busy ? 'Сохраняем…' : 'Сохранить пароль'}</button>
    </form>
  </AuthLayout>
}
