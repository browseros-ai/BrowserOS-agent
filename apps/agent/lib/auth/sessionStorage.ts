import { storage } from '@wxt-dev/storage'
import type { Session, User } from 'better-auth/types'
import { useEffect, useState } from 'react'

interface SessionInfo {
  session?: Session
  user?: User
}

export const sessionStorage = storage.defineItem<SessionInfo>(
  'local:sessionInfo',
  {
    fallback: {},
  },
)

export const useSessionInfo = () => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({})

  useEffect(() => {
    sessionStorage.getValue().then(setSessionInfo)
    const unwatch = sessionStorage.watch((newValue) => {
      setSessionInfo(newValue ?? {})
    })
    return unwatch
  }, [])

  const updateSessionInfo = async (info: SessionInfo) => {
    await sessionStorage.setValue(info)
  }

  return { sessionInfo, updateSessionInfo }
}
