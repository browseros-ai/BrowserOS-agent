import { createContext, type FC, type ReactNode, use } from 'react'
import { getClient, type RpcClient } from './getClient'

const RpcClientContext = createContext<Promise<RpcClient> | null>(null)

/**
 * @public
 */
export const RpcClientProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  return (
    <RpcClientContext.Provider value={getClient()}>
      {children}
    </RpcClientContext.Provider>
  )
}

/**
 * @public
 */
export function useRpcClient(): RpcClient {
  const promise = use(RpcClientContext)
  if (!promise) {
    throw new Error('useRpcClient must be used within RpcClientProvider')
  }
  return use(promise)
}
