import { storage } from '@wxt-dev/storage'

export const onboardingCompletedStorage = storage.defineItem<boolean>(
  'local:onboardingCompleted',
  { fallback: false },
)

export const importHintDismissedAtStorage = storage.defineItem<number | null>(
  'local:importHintDismissedAt',
  { fallback: null },
)
