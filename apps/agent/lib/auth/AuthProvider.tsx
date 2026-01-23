import type { FC, PropsWithChildren } from 'react'
import { useSession } from './auth-client'
import { useSessionInfo } from './sessionStorage'

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const { data } = useSession()
  const { updateSessionInfo } = useSessionInfo()

  useEffect(() => {
    updateSessionInfo({
      session: data?.session,
      user: data?.user,
    })
  }, [data])

  return <>{children} </>
}
