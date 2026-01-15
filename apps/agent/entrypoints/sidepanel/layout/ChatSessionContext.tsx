import { createContext, type FC, type ReactNode, useContext } from 'react'
import { useChatSession } from '../index/useChatSession'

type ChatSessionContextValue = ReturnType<typeof useChatSession>

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null)

export const ChatSessionProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const session = useChatSession()
  return (
    <ChatSessionContext.Provider value={session}>
      {children}
    </ChatSessionContext.Provider>
  )
}

export const useChatSessionContext = () => {
  const context = useContext(ChatSessionContext)
  if (!context) {
    throw new Error(
      'useChatSessionContext must be used within a ChatSessionProvider',
    )
  }
  return context
}
