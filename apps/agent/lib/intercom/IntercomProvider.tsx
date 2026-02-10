import {
  createContext,
  type FC,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react'
import { env } from '../env'

export interface IntercomApi {
  show: () => void
  showMessages: () => void
  showNewMessage: (content: string) => void
}

const IntercomContext = createContext<IntercomApi | null>(null)

export const IntercomProvider: FC<PropsWithChildren> = ({ children }) => {
  const appId = env.VITE_PUBLIC_INTERCOM_APP_ID

  const api = useMemo<IntercomApi | null>(() => {
    if (!appId) return null

    const messengerUrl = `https://intercom.help/browseros`

    return {
      show: () => window.open(messengerUrl, '_blank', 'noopener,noreferrer'),
      showMessages: () =>
        window.open(messengerUrl, '_blank', 'noopener,noreferrer'),
      showNewMessage: (content: string) => {
        const url = content
          ? `${messengerUrl}?q=${encodeURIComponent(content)}`
          : messengerUrl
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    }
  }, [appId])

  return (
    <IntercomContext.Provider value={api}>{children}</IntercomContext.Provider>
  )
}

export const useIntercomSafe = () => useContext(IntercomContext)
