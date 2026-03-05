import { env } from '@/lib/env'

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on'])

function parseKimiLaunchFlag(value: string | undefined): boolean {
  if (!value) return false
  return ENABLED_VALUES.has(value.trim().toLowerCase())
}

const kimiLaunchEnabled = parseKimiLaunchFlag(env.VITE_PUBLIC_KIMI_LAUNCH)

export function isKimiLaunchEnabled(): boolean {
  return kimiLaunchEnabled
}
