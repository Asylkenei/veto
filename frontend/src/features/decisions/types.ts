export type Method = 'majority' | 'unanimity' | 'objections'
export type RoomStatus = 'COLLECTING' | 'READY' | 'VOTING' | 'COMPLETED' | 'NO_CONSENSUS' | 'CANCELLED'
export interface NotificationPrefs { push: boolean; invites: boolean; voting: boolean; results: boolean; activity: boolean; digest: 'instant' | 'important' }
export interface User {
  id: string; display_name: string; email: string | null; is_guest: boolean; avatar_color: string
  theme: 'system' | 'light' | 'dark'; city: string; notification_prefs: NotificationPrefs; created_at?: string
}
export interface Participant { id: string; display_name: string; role: 'HOST' | 'PARTICIPANT'; avatar_color?: string }
export interface Option { id: string; title: string; description: string; author: string; author_id: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED'; rejection_reason: string; place_id: string | null; can_edit: boolean; position: number; image_url: string; image_credit: string }
export interface Comment { id: string; option_id: string; author: string; text: string; created_at: string }
export interface Ballot { participant_id: string; choice_option_id: string | null; details: { option_id: string; stance: 'yes' | 'no' }[] }
export interface ResultOption { id: string; title: string; description: string }
export interface DecisionResult {
  success: boolean; winner?: ResultOption | null; acceptable?: ResultOption[]; tie?: boolean; leaders?: ResultOption[]
  tiebreak_candidates?: ResultOption[]; forced?: boolean
  counts: { option: ResultOption; count?: number; objections?: number; agree?: number }[]; submitted: number; total: number; explanation: string
}
export interface Tiebreak { option: ResultOption; candidates: ResultOption[]; drawn_at: string; drawn_by: string; note: string }
export interface Round {
  id: string; number: number; status: string; kind: 'regular' | 'runoff'; end_reason: '' | 'all_voted' | 'forced' | 'deadline'
  participant_ids: string[]; option_ids: string[]; ballots: Ballot[]; result: DecisionResult | null; tiebreak: Tiebreak | null
  started_at: string | null; ended_at: string | null
}
export interface Room {
  id: string; title: string; question: string; description: string; method: Method; status: RoomStatus; host_id: string; host_name: string
  participant_count: number; allow_suggestions: boolean; allow_comments: boolean; hide_results: boolean; deadline: string | null; created_at: string
  updated_at: string | null; invite_code: string | null; template: string; version: number
  participants: Participant[]; options: Option[]; comments: Comment[]; rounds: Round[]; is_host: boolean; is_member: boolean; current_user_id: string | null
}
export const METHODS: Record<Method, { name: string; detail: string; fit: string }> = {
  majority: { name: 'Большинство', detail: 'Каждый выбирает один вариант. Побеждает вариант с наибольшим числом голосов. При равенстве — равнозначные результаты.', fit: 'Когда важен быстрый выбор из нескольких вариантов.' },
  unanimity: { name: 'Единогласие', detail: 'Все участники должны выбрать один и тот же вариант.', fit: 'Когда важно, чтобы каждый поддерживал итог.' },
  objections: { name: 'Без возражений', detail: 'Каждый оценивает каждый вариант. Приемлемы все варианты, против которых никто не возразил.', fit: 'Когда важно услышать сомнения и найти приемлемое решение.' },
}
export const STATUS_LABELS: Record<RoomStatus, string> = {
  COLLECTING: 'Сбор вариантов', READY: 'Готово к голосованию', VOTING: 'Голосование', COMPLETED: 'Решение принято', NO_CONSENSUS: 'Нет согласия', CANCELLED: 'Отменено',
}
export const ACTIVE_STATUSES: RoomStatus[] = ['COLLECTING', 'READY', 'VOTING']
export const DONE_STATUSES: RoomStatus[] = ['COMPLETED', 'NO_CONSENSUS', 'CANCELLED']
