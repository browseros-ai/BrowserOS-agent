export function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`
  }
  return `${n}`
}

export function formatDaysRemaining(closeTime: string): string {
  const now = new Date()
  const close = new Date(closeTime)
  const diffMs = close.getTime() - now.getTime()

  if (diffMs < 0) return '0d'

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d`
  if (diffHours > 0) return `${diffHours}h`
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  return `${diffMinutes}m`
}
