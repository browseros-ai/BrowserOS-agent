import { storage } from '@wxt-dev/storage'

export const scheduleSuggestionDismissedStorage = storage.defineItem<boolean>(
  'local:scheduleSuggestionDismissed',
  { fallback: false },
)

export const connectAppSuggestionDismissedStorage = storage.defineItem<boolean>(
  'local:connectAppSuggestionDismissed',
  { fallback: false },
)
