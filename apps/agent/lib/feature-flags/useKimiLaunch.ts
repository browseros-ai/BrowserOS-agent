import { useEffect, useState } from 'react'
import { kimiLaunchStorage } from './kimi-launch'

export function useKimiLaunch(): boolean {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    kimiLaunchStorage.getValue().then((val) => setEnabled(val ?? true))

    const unwatch = kimiLaunchStorage.watch((val) => {
      setEnabled(val ?? true)
    })

    return unwatch
  }, [])

  return enabled
}
