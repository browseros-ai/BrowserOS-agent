import { storage } from '#imports'

export const declinedAppsStorage = storage.defineItem<string[]>(
  'local:declinedApps',
  { fallback: [] },
)
