import { type FC, Suspense } from 'react'
import { RpcClientProvider } from '@/lib/rpc/RpcClientProvider'
import { CreateGraph } from './CreateGraph'

export const CreateGraphWrapper: FC = () => {
  return (
    <RpcClientProvider>
      <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
        <CreateGraph />
      </Suspense>
    </RpcClientProvider>
  )
}
