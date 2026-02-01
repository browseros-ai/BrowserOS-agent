import type { FC, PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { useSession } from './auth-client'
import { useSessionInfo } from './sessionStorage'

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const { data } = useSession()
  const { updateSessionInfo } = useSessionInfo()

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-run when data changes
  useEffect(() => {
    updateSessionInfo({
      session: data?.session,
      user: data?.user,
    })
  }, [data])

  return <>{children}</>
}
