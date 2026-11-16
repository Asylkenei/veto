export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}
export const people = (n: number) => plural(n, 'участник', 'участника', 'участников')

/** SQLite may return timestamps without a zone; they are UTC. */
export const parseIso = (iso: string) => new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z')

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z')
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'только что'
  if (s < 3600) return `${plural(Math.floor(s / 60), 'минуту', 'минуты', 'минут')} назад`
  if (s < 86400) return `${plural(Math.floor(s / 3600), 'час', 'часа', 'часов')} назад`
  if (s < 86400 * 7) return `${plural(Math.floor(s / 86400), 'день', 'дня', 'дней')} назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z')
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
