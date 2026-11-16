import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/auth'
import { Avatar, AVATAR_COLORS } from '../../components/Avatar'
import { Modal } from '../../components/Modal'
import { ErrorNotice } from '../../components/States'
import { useToast } from '../../components/Toast'
import { api } from '../../lib/api'
import { PasswordInput, passwordStrength, StrengthMeter } from '../auth/AuthPages'
import { Toggle } from '../decisions/CreateDecisionPage'
import { disablePush, enablePush, pushSupported } from '../notifications/push'
import type { User } from '../decisions/types'

const SECTIONS = [['profile', 'Профиль'], ['notifications', 'Уведомления'], ['appearance', 'Внешний вид'], ['account', 'Аккаунт']] as const

export function SettingsPage() {
  const location = useLocation()
  const [section, setSection] = useState(location.hash.replace('#', '') || 'profile')
  useEffect(() => { if (location.hash) setSection(location.hash.replace('#', '')) }, [location.hash])
  return <div className="page">
    <div className="page-head"><div><h1>Настройки</h1></div></div>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Разделы настроек">{SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}</a>)}</nav>
      <div className="settings-body">
        {section === 'profile' && <ProfileSection />}
        {section === 'notifications' && <NotificationsSection />}
        {section === 'appearance' && <AppearanceSection />}
        {section === 'account' && <AccountSection />}
      </div>
    </div>
  </div>
}

function useSave() {
  const { setUser } = useApp()
  const toast = useToast()
  return async (patch: Parameters<typeof api.updateMe>[0], message = 'Сохранено') => {
    try { setUser(await api.updateMe(patch)); toast(message); return true } catch (e) { toast(e instanceof Error ? e.message : 'Не удалось сохранить', 'error'); return false }
  }
}

function ProfileSection() {
  const { user } = useApp()
  const save = useSave()
  const [name, setName] = useState(user.display_name)
  const [email, setEmail] = useState(user.email ?? '')
  const [city, setCity] = useState(user.city)
  const [color, setColor] = useState(user.avatar_color)
  const dirty = name !== user.display_name || email !== (user.email ?? '') || city !== user.city || color !== user.avatar_color
  async function submit(e: FormEvent) {
    e.preventDefault()
    await save({ display_name: name.trim(), city, avatar_color: color, ...(user.is_guest ? {} : { email: email.trim() }) }, 'Профиль обновлён')
  }
  return <form className="card settings-card" onSubmit={submit}>
    <h2>Профиль</h2>
    <div className="avatar-picker"><Avatar name={name || user.display_name} color={color} size="lg" />
      <div role="radiogroup" aria-label="Цвет аватара">{AVATAR_COLORS.map((c) => <button type="button" role="radio" aria-checked={c === color} aria-label={c} key={c} className={`swatch tone-${c} ${c === color ? 'selected' : ''}`} onClick={() => setColor(c)} />)}</div></div>
    <label className="field"><span>Имя</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
    {user.is_guest ? <div className="notice"><span>У гостевого профиля нет email. <Link to="/register" className="link">Сохраните аккаунт</Link>, чтобы входить с любого устройства.</span></div>
      : <label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
    <label className="field"><span>Город <em>необязательно</em></span><input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Например, Астана" maxLength={80} /><small className="help">Помогает подбирать места в «Интересном».</small></label>
    <div className="row-end"><button className="btn primary" disabled={!dirty || !name.trim()}>Сохранить</button></div>
  </form>
}

function NotificationsSection() {
  const { user, meta, refreshUser } = useApp()
  const save = useSave()
  const toast = useToast()
  const prefs = user.notification_prefs
  const [busy, setBusy] = useState(false)
  const permission = pushSupported() ? Notification.permission : 'unsupported'
  const set = (key: keyof User['notification_prefs'], value: boolean | string) => void save({ notification_prefs: { [key]: value } })
  async function togglePush(on: boolean) {
    setBusy(true)
    try {
      if (on) {
        const r = await enablePush()
        if (r === 'denied') toast('Браузер запретил уведомления — разрешите их в настройках сайта', 'error')
        if (r === 'unavailable') toast('Push недоступен в этом браузере или на сервере', 'error')
      } else await disablePush()
      await refreshUser()
    } finally { setBusy(false) }
  }
  return <section className="card settings-card">
    <h2>Уведомления</h2>
    <p className="muted">В центре уведомлений внутри VETO сообщения появляются всегда. Push приходят на устройство, даже когда вкладка закрыта.</p>
    <div className="toggle-row"><div><b>Push-уведомления на этом устройстве</b><small>{!meta?.features.push ? 'Сервер пока не поддерживает push.' : permission === 'unsupported' ? 'Этот браузер не поддерживает push.' : permission === 'denied' ? 'Заблокированы в настройках браузера.' : 'Старт голосования, напоминание о сроке и результат.'}</small></div>
      <button type="button" role="switch" aria-checked={prefs.push} aria-label="Push-уведомления" disabled={busy || !meta?.features.push || permission === 'unsupported'} className={`switch ${prefs.push ? 'on' : ''}`} onClick={() => void togglePush(!prefs.push)} /></div>
    <h3 className="subhead">О чём сообщать</h3>
    <Toggle title="Приглашения" detail="Вас пригласили в решение по email." checked={prefs.invites} onChange={(v) => set('invites', v)} />
    <Toggle title="Голосования" detail="Старт голосования, повторный раунд и напоминание о сроке." checked={prefs.voting} onChange={(v) => set('voting', v)} />
    <Toggle title="Результаты" detail="Итог готов, голосование закрыто, случайный выбор." checked={prefs.results} onChange={(v) => set('results', v)} />
    <Toggle title="Активность в моих комнатах" detail="Кто-то присоединился к вашему решению." checked={prefs.activity} onChange={(v) => set('activity', v)} />
  </section>
}

function AppearanceSection() {
  const { user } = useApp()
  const save = useSave()
  return <section className="card settings-card">
    <h2>Внешний вид</h2>
    <div className="field"><span>Тема</span><div className="segmented">{([['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']] as const).map(([v, l]) => <button key={v} type="button" className={user.theme === v ? 'active' : ''} onClick={() => void save({ theme: v }, 'Тема изменена')}>{l}</button>)}</div></div>
  </section>
}

function AccountSection() {
  const { user, logout } = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [delPassword, setDelPassword] = useState('')
  const [delWord, setDelWord] = useState('')
  const [delError, setDelError] = useState('')
  async function changePassword(e: FormEvent) {
    e.preventDefault(); setError('')
    if (!passwordStrength(next).valid) { setError('Новый пароль слишком простой'); return }
    try { await api.changePassword(current, next); setCurrent(''); setNext(''); toast('Пароль изменён. Другие устройства вышли из аккаунта.') } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сменить пароль') }
  }
  async function remove() {
    setDelError('')
    try { await api.deleteAccount(user.is_guest ? null : delPassword); await logout().catch(() => null); navigate('/login') } catch (err) { setDelError(err instanceof Error ? err.message : 'Не удалось удалить') }
  }
  return <>
    {!user.is_guest && <form className="card settings-card" onSubmit={changePassword}>
      <h2>Пароль</h2>
      <label className="field" htmlFor="cur"><span>Текущий пароль</span><PasswordInput id="cur" value={current} onChange={setCurrent} autoComplete="current-password" /></label>
      <label className="field" htmlFor="nw"><span>Новый пароль</span><PasswordInput id="nw" value={next} onChange={setNext} autoComplete="new-password" /><StrengthMeter password={next} /></label>
      {error && <ErrorNotice message={error} />}
      <div className="row-end"><button className="btn primary" disabled={!current || !next}>Изменить пароль</button></div>
    </form>}
    <section className="card settings-card">
      <h2>Сеанс</h2>
      <div className="row-between"><p className="muted">Выйти из аккаунта на этом устройстве.</p><button className="btn" onClick={async () => { await logout(); navigate('/login') }}>Выйти</button></div>
    </section>
    <section className="card settings-card danger-zone">
      <h2>Удаление аккаунта</h2>
      <p className="muted">Имя и email будут удалены, войти снова не получится. Ваши голоса останутся в чужих решениях обезличенно — иначе изменились бы уже подсчитанные итоги.</p>
      <div className="row-end"><button className="btn danger" onClick={() => setDeleting(true)}>Удалить аккаунт</button></div>
    </section>
    <Modal open={deleting} onClose={() => setDeleting(false)} title="Удалить аккаунт навсегда?">
      <div className="form">
        {!user.is_guest && <label className="field" htmlFor="delpw"><span>Пароль</span><PasswordInput id="delpw" value={delPassword} onChange={setDelPassword} autoComplete="current-password" /></label>}
        <label className="field"><span>Введите слово УДАЛИТЬ</span><input className="input" value={delWord} onChange={(e) => setDelWord(e.target.value)} /></label>
        {delError && <ErrorNotice message={delError} />}
        <div className="modal-actions"><button className="btn" onClick={() => setDeleting(false)}>Отмена</button><button className="btn danger" disabled={delWord !== 'УДАЛИТЬ' || (!user.is_guest && !delPassword)} onClick={() => void remove()}>Удалить навсегда</button></div>
      </div>
    </Modal>
  </>
}
