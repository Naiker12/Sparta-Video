import { t } from '../i18n/locale'

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 60) {
    return t('hace unos instantes', 'just now')
  }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return t(`hace ${diffMin} min`, `${diffMin}m ago`)
  }
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) {
    return t(`hace ${diffHours} h`, `${diffHours}h ago`)
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) {
    return t(`hace ${diffDays} d`, `${diffDays}d ago`)
  }
  return date.toLocaleDateString()
}

export function formatDurationCompact(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const formatTime = formatDurationCompact
