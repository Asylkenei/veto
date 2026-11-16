import type { Room, User } from '../features/decisions/types'
import type { Place, PlaceCategory } from '../features/discovery/types'

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError' }
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void) { onUnauthorized = handler }

async function request<T>(path: string, init: RequestInit = {}, { silent401 = false } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  let response: Response
  // Session lives in an HttpOnly cookie — never in localStorage.
  try { response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' }) }
  catch { throw new ApiError('Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.', 0) }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && !silent401) onUnauthorized?.()
    throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Запрос не выполнен', response.status)
  }
  return data as T
}
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) })
const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

export interface AuthResult { user: User; expires_at: string }
export interface Meta { version: string; features: { push: boolean; password_recovery: boolean; live_updates: boolean }; support_email: string }
export interface AppNotification { id: string; type: string; title: string; body: string; room_id: string | null; link: string; created_at: string; read: boolean }
export interface RoomBody { title: string; question: string; description: string; method: string; allow_suggestions: boolean; allow_comments: boolean; hide_results: boolean; deadline: string | null; template?: string; options?: { title: string; description: string; place_id?: string | null }[] }

export const api = {
  health: () => request<{ status: string }>('/health'),
  meta: () => request<Meta>('/meta'),
  // auth
  me: () => request<User>('/auth/me', {}, { silent401: true }),
  session: () => request<{ user: User | null }>('/auth/session'),
  register: (body: { display_name: string; email: string; password: string; remember: boolean }) => post<AuthResult>('/auth/register', body),
  login: (body: { email: string; password: string; remember: boolean }) => post<AuthResult>('/auth/login', body),
  guest: (display_name: string) => post<AuthResult>('/auth/guest', { display_name }),
  logout: () => post<void>('/auth/logout'),
  updateMe: (body: Partial<Omit<User, 'notification_prefs'>> & { notification_prefs?: Partial<User['notification_prefs']> }) => patch<User>('/auth/me', body),
  changePassword: (current_password: string, new_password: string) => post<void>('/auth/password', { current_password, new_password }),
  deleteAccount: (password: string | null) => post<void>('/auth/delete', { password, confirm: 'УДАЛИТЬ' }),
  recovery: () => request<{ available: boolean; support_email: string }>('/auth/recovery'),
  recoveryRequest: (email: string) => post<{ ok: boolean }>('/auth/recovery/request', { email }),
  recoveryConfirm: (token: string, password: string) => post<void>('/auth/recovery/confirm', { token, password }),
  // rooms
  rooms: () => request<Room[]>('/rooms'),
  room: (id: string) => request<Room>(`/rooms/${id}`),
  roomByCode: (code: string) => request<{ room_id: string }>(`/rooms/by-code/${encodeURIComponent(code)}`),
  createRoom: (body: RoomBody) => post<Room>('/rooms', body),
  updateRoom: (id: string, body: Partial<RoomBody>) => patch<Room>(`/rooms/${id}`, body),
  join: (id: string) => post<Room>(`/rooms/${id}/join`),
  leave: (id: string) => post<void>(`/rooms/${id}/leave`),
  removeParticipant: (id: string, userId: string) => del<Room>(`/rooms/${id}/participants/${userId}`),
  inviteByEmail: (id: string, email: string) => post<{ ok: boolean; display_name: string }>(`/rooms/${id}/invite`, { email }),
  addOption: (id: string, body: { title: string; description: string; place_id?: string | null }) => post<Room>(`/rooms/${id}/options`, body),
  reorderOptions: (id: string, ids: string[]) => put<Room>(`/rooms/${id}/options/order`, { ids }),
  editOption: (id: string, optionId: string, body: { title: string; description: string }) => put<Room>(`/rooms/${id}/options/${optionId}`, body),
  deleteOption: (id: string, optionId: string) => del<Room>(`/rooms/${id}/options/${optionId}`),
  moderateOption: (id: string, optionId: string, body: { status: 'ACCEPTED' | 'REJECTED'; rejection_reason: string }) => patch<Room>(`/rooms/${id}/options/${optionId}`, body),
  comment: (id: string, optionId: string, text: string) => post<Room>(`/rooms/${id}/options/${optionId}/comments`, { text }),
  start: (id: string) => post<Room>(`/rooms/${id}/start`),
  finish: (id: string) => post<Room>(`/rooms/${id}/finish`),
  newRound: (id: string) => post<Room>(`/rooms/${id}/rounds`),
  runoff: (id: string) => post<Room>(`/rooms/${id}/runoff`),
  tiebreak: (id: string) => post<Room>(`/rooms/${id}/tiebreak`),
  vote: (id: string, body: { choice_option_id?: string; details?: Record<string, 'yes' | 'no'> }) => post<Room>(`/rooms/${id}/votes`, body),
  // notifications
  notifications: () => request<{ unread: number; items: AppNotification[] }>('/notifications'),
  markRead: (ids?: string[]) => post<{ unread: number }>('/notifications/read', { ids: ids ?? null }),
  pushKey: () => request<{ available: boolean; public_key: string | null }>('/push/key'),
  pushSubscribe: (sub: PushSubscriptionJSON) => post<{ ok: boolean }>('/push/subscribe', sub),
  pushUnsubscribe: (endpoint?: string) => post<{ ok: boolean }>('/push/unsubscribe', { endpoint: endpoint ?? null }),
  // discovery
  placeCategories: () => request<PlaceCategory[]>('/places/categories'),
  places: (params: { category?: string; q?: string } = {}) => request<Place[]>(`/places?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`),
  recentPlaces: () => request<Place[]>('/places/recent'),
  popularPlaces: () => request<{ is_popularity: boolean; items: Place[] }>('/places/popular'),
  savedPlaces: () => request<Place[]>('/places/saved'),
  placeOfDay: () => request<{ day: string; place: Place }>('/places/today'),
  randomPlace: (exclude: string[], category?: string | null) => post<{ place: Place; exhausted: boolean; remaining: number; note: string }>('/places/random', { exclude, category: category || null }),
  place: (id: string) => request<Place>(`/places/${id}`),
  setVisited: (id: string, value: boolean) => put<Place>(`/places/${id}/visited`, { value }),
  setSaved: (id: string, value: boolean) => put<Place>(`/places/${id}/saved`, { value }),
  // support
  supportTicket: (body: { kind: string; category: string; subject: string; message: string; contact: string }) => post<{ id: string }>('/support/tickets', body),
  myTickets: () => request<{ id: string; kind: string; subject: string; status: string; created_at: string }[]>('/support/tickets'),
}
