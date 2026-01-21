import { type FC, Suspense } from 'react'
import { WorkflowsPage } from './WorkflowsPage'

const LoadingFallback = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="text-muted-foreground">Loading workflows...</div>
  </div>
)

export const WorkflowsPageWrapper: FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WorkflowsPage />
    </Suspense>
  )
}
