import { isKimiLaunchEnabled } from './kimi-launch'

export function useKimiLaunch(): boolean {
  return isKimiLaunchEnabled()
}
