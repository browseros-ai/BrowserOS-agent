import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeDate(dateString: string): string {
  const timestamp = Date.parse(dateString)
  if (Number.isNaN(timestamp)) {
    return 'Unknown'
  }

  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString()
}

export function countLines(text: string): number {
  return text.trim().length === 0 ? 0 : text.trimEnd().split('\n').length
}
