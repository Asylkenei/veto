import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CircleHelp, Compass, Home, Layers3, LogOut, Plus, Settings, UserRound } from 'lucide-react'
import { useApp } from './auth'
import { Avatar } from '../components/Avatar'
import { NotificationsPanel } from '../features/notifications/NotificationsPanel'

export function TopNav({ unread, onUnread }: { unread: number; onUnread: (n: number) => void }) {
  const { user, logout } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [menu, setMenu] = useState<'none' | 'profile' | 'bell'>('none')
  const [scrolled, setScrolled] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const [ring, setRing] = useState(false)
  const lastUnread = useRef(unread)
  // Ring the bell only when a *new* notification arrives, not on first load.
  useEffect(() => {
    if (unread > lastUnread.current) { setRing(true); const t = window.setTimeout(() => setRing(false), 1100); lastUnread.current = unread; return () => window.clearTimeout(t) }
    lastUnread.current = unread
  }, [unread])

  useEffect(() => { setMenu('none') }, [location.pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setMenu('none') }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('mousedown', onDoc)
    return () => { window.removeEventListener('scroll', onScroll); document.removeEventListener('mousedown', onDoc) }
  }, [])

  const decisionsActive = location.pathname.startsWith('/decisions') || location.pathname.startsWith('/rooms') || location.pathname.startsWith('/join')
  return <>
    <header className={`topnav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="topnav-inner" ref={wrap}>
        <Link to="/" className="brand" aria-label="VETO — на главную"><span className="brand-mark">V</span><span className="brand-word">VETO</span></Link>
        <nav className="topnav-links" aria-label="Основная навигация">
          <NavLink to="/" end>Главная</NavLink>
          <NavLink to="/decisions" className={() => (decisionsActive ? 'active' : '')}>Мои решения</NavLink>
          <NavLink to="/explore">Интересное</NavLink>
        </nav>
        <div className="topnav-actions">
          <Link to="/decisions/new" className="btn primary small hide-mobile"><Plus size={15} />Создать</Link>
          <div className="menu-anchor">
            <button className={`icon-btn bell ${menu === 'bell' ? 'is-open' : ''} ${ring ? 'is-ringing' : ''}`} onClick={() => setMenu(menu === 'bell' ? 'none' : 'bell')} aria-label={`Уведомления${unread ? `: ${unread} непрочитанных` : ''}`} aria-expanded={menu === 'bell'}>
              <Bell size={18} />{unread > 0 && <span className="badge" key={unread}>{unread > 9 ? '9+' : unread}</span>}
            </button>
            {menu === 'bell' && <NotificationsPanel onUnread={onUnread} onClose={() => setMenu('none')} />}
          </div>
          <Link to="/help" className="icon-btn hide-mobile" aria-label="Помощь"><CircleHelp size={18} /></Link>
          <div className="menu-anchor">
            <button className="avatar-btn" onClick={() => setMenu(menu === 'profile' ? 'none' : 'profile')} aria-label="Меню профиля" aria-expanded={menu === 'profile'}>
              <Avatar name={user.display_name} color={user.avatar_color} />
            </button>
            {menu === 'profile' && <div className="dropdown profile-dropdown" role="menu">
              <div className="dropdown-head"><b>{user.display_name}</b><small>{user.email ?? 'Гостевой профиль'}</small></div>
              {user.is_guest && <Link to="/register" className="dropdown-cta" role="menuitem">Сохранить аккаунт — добавить email</Link>}
              <Link to="/settings" role="menuitem"><Settings size={16} />Настройки</Link>
              <Link to="/settings#profile" role="menuitem"><UserRound size={16} />Профиль</Link>
              <Link to="/help" role="menuitem"><CircleHelp size={16} />Помощь и поддержка</Link>
              <button role="menuitem" onClick={async () => { await logout(); navigate('/login') }}><LogOut size={16} />Выйти</button>
            </div>}
          </div>
        </div>
      </div>
    </header>
    <nav className="tabbar" aria-label="Навигация">
      <NavLink to="/" end><Home size={20} /><span>Главная</span></NavLink>
      <NavLink to="/decisions" className={() => (decisionsActive ? 'active' : '')}><Layers3 size={20} /><span>Решения</span></NavLink>
      <NavLink to="/explore"><Compass size={20} /><span>Интересное</span></NavLink>
      <NavLink to="/help"><CircleHelp size={20} /><span>Помощь</span></NavLink>
    </nav>
  </>
}
