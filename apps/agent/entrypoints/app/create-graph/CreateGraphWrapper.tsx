import { type FC, Suspense } from 'react'
import { RpcClientProvider } from '@/lib/rpc/RpcClientProvider'
import { CreateGraph } from './CreateGraph'

const LoadingFallback = () => (
  <div className="flex h-dvh w-dvw items-center justify-center bg-background">
    <div className="text-muted-foreground">Loading...</div>
  </div>
)

export const CreateGraphWrapper: FC = () => {
  return (
    <RpcClientProvider>
      <Suspense fallback={<LoadingFallback />}>
        <CreateGraph />
      </Suspense>
    </RpcClientProvider>
  )
}
