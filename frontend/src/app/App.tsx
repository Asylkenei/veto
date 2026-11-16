import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { TopNav } from './TopNav'
import { LoadingState } from '../components/States'
import { ToastProvider } from '../components/Toast'
import { useEventStream } from '../lib/live'
import { DashboardPage } from '../features/decisions/DashboardPage'
import { MyDecisionsPage } from '../features/decisions/MyDecisionsPage'
import { CreateDecisionPage } from '../features/decisions/CreateDecisionPage'
import { DecisionRoomPage } from '../features/decisions/DecisionRoomPage'
import { JoinRoomPage } from '../features/decisions/JoinRoomPage'
import { PreparePage } from '../features/decisions/PreparePage'
import { VotingPage } from '../features/decisions/VotingPage'
import { ResultsPage } from '../features/decisions/ResultsPage'
import { LoginPage, RegisterPage } from '../features/auth/AuthPages'
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/RecoveryPages'
import { ExplorePage } from '../features/discovery/ExplorePage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { HelpPage } from '../features/help/HelpPage'
import { NotificationsPage } from '../features/notifications/NotificationsPage'
import { registerServiceWorker } from '../features/notifications/push'

/** Unauthenticated visitors go to /login and come back to the exact page (e.g. an invite). */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

function Shell({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const onUnread = useCallback((n: number) => setUnread(n), [])
  useEventStream(user ? '/api/stream' : null, {
    notifications: (d: { unread: number }) => setUnread(d.unread),
    rooms: () => window.dispatchEvent(new Event('veto:rooms-changed')),
  })
  const location = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [location.pathname])
  if (!user) return <>{children}</>
  return <div className="app">
    <a href="#main" className="skip-link">Перейти к содержимому</a>
    <TopNav unread={unread} onUnread={onUnread} />
    <main id="main" className="main">{location.pathname === '/notifications' ? <NotificationsPage onUnread={onUnread} /> : children}</main>
  </div>
}

function AppRoutes() {
  const { booting, user } = useAuth()
  useEffect(() => { void registerServiceWorker() }, [])
  if (booting) return <LoadingState label="Открываем VETO…" />
  const guard = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>
  return <Shell><Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/join/:roomId" element={<JoinRoomPage />} />
    <Route path="/join" element={guard(<JoinRoomPage />)} />
    <Route path="/" element={guard(<DashboardPage />)} />
    <Route path="/decisions" element={guard(<MyDecisionsPage />)} />
    <Route path="/decisions/new" element={guard(<CreateDecisionPage />)} />
    <Route path="/rooms/:roomId" element={guard(<DecisionRoomPage />)} />
    <Route path="/rooms/:roomId/prepare" element={guard(<PreparePage />)} />
    <Route path="/rooms/:roomId/vote" element={guard(<VotingPage />)} />
    <Route path="/rooms/:roomId/results" element={guard(<ResultsPage />)} />
    <Route path="/explore" element={guard(<ExplorePage />)} />
    <Route path="/settings" element={guard(<SettingsPage />)} />
    <Route path="/help" element={user ? <HelpPage /> : <HelpPage publicView />} />
    <Route path="/notifications" element={guard(<div />)} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Shell>
}

export default function App() {
  return <AuthProvider><ToastProvider><AppRoutes /></ToastProvider></AuthProvider>
}
