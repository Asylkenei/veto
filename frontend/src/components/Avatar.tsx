export function Avatar({ name, color = 'sand', size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`avatar avatar-${size} tone-${color}`} title={name} aria-hidden="true">{(name || '?').trim()[0]?.toUpperCase()}</span>
}
export const AVATAR_COLORS = ['sand', 'sage', 'sky', 'rose', 'lilac', 'amber', 'slate']
