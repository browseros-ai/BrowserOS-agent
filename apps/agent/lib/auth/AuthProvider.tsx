import type { FC, PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { useSession } from './auth-client'
import { useSessionInfo } from './sessionStorage'

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const { data, isPending } = useSession()
  const { updateSessionInfo } = useSessionInfo()

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-run when data changes
  useEffect(() => {
    if (!isPending) {
      updateSessionInfo({
        session: data?.session,
        user: data?.user,
      })
    }
  }, [data, isPending])

  return <>{children}</>
}
