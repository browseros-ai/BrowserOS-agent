import { type FC, Suspense } from 'react'
import { WorkflowsPage } from './WorkflowsPage'

export const WorkflowsPageWrapper: FC = () => {
  return (
    <Suspense fallback={<div className="h-dvh w-dvw bg-background" />}>
      <WorkflowsPage />
    </Suspense>
  )
}
