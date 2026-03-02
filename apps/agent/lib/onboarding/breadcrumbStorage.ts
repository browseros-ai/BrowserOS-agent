import { storage } from '@wxt-dev/storage'

const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

export const scheduleSuggestionDismissedAtStorage = storage.defineItem<number>(
  'local:scheduleSuggestionDismissedAt',
  { fallback: 0 },
)

export const connectAppSuggestionDismissedAtStorage =
  storage.defineItem<number>('local:connectAppSuggestionDismissedAt', {
    fallback: 0,
  })

export function isDismissedWithinCooldown(dismissedAt: number): boolean {
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
}
