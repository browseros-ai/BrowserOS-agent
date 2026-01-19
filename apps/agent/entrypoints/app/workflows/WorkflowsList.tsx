import type { FC } from 'react'
import type { Workflow } from '@/lib/workflows/workflowStorage'
import { WorkflowCard } from './WorkflowCard'

interface WorkflowsListProps {
  workflows: Workflow[]
  onDelete: (workflowId: string) => void
  onRun: (workflowId: string) => void
}

export const WorkflowsList: FC<WorkflowsListProps> = ({
  workflows,
  onDelete,
  onRun,
}) => {
  if (workflows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="rounded-lg border border-border border-dashed py-8 text-center">
          <p className="text-muted-foreground text-sm">
            No workflows yet. Create one to automate browser tasks.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onDelete={() => onDelete(workflow.id)}
          onRun={() => onRun(workflow.id)}
        />
      ))}
    </div>
  )
}
