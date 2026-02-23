export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(0)}K`
  }
  return `$${volume}`
}

export function formatTimeRemaining(closeTime: string): string {
  const now = new Date()
  const close = new Date(closeTime)
  const diffMs = close.getTime() - now.getTime()

  if (diffMs < 0) return 'Closed'

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) {
    const months = Math.floor(diffDays / 30)
    return `${months}mo left`
  }
  if (diffDays > 0) {
    return `${diffDays}d left`
  }
  if (diffHours > 0) {
    return `${diffHours}h left`
  }
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  return `${diffMinutes}m left`
}

export function formatTraders(count: number): string {
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return `${count}`
}
