import type { FC } from 'react'
import { RpcClientProvider } from '@/lib/rpc/RpcClientProvider'
import { CreateGraph } from './CreateGraph'

export const CreateGraphWrapper: FC = () => {
  return (
    <RpcClientProvider>
      <CreateGraph />
    </RpcClientProvider>
  )
}
