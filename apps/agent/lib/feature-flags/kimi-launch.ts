import { storage } from '@wxt-dev/storage'

const KIMI_LAUNCH_KEY = 'local:feature-flag-kimi-launch'

const kimiLaunchStorage = storage.defineItem<boolean>(KIMI_LAUNCH_KEY, {
  fallback: true,
})

export async function isKimiLaunchEnabled(): Promise<boolean> {
  return (await kimiLaunchStorage.getValue()) ?? true
}

export function setKimiLaunchEnabled(enabled: boolean): Promise<void> {
  return kimiLaunchStorage.setValue(enabled)
}

export { kimiLaunchStorage }
