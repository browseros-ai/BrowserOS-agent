import { Pencil, Play, Trash2 } from 'lucide-react'
import type { FC } from 'react'
import { NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import type { Workflow } from '@/lib/workflows/workflowStorage'

interface WorkflowCardProps {
  workflow: Workflow
  onDelete: () => void
  onRun: () => void
}

export const WorkflowCard: FC<WorkflowCardProps> = ({
  workflow,
  onDelete,
  onRun,
}) => {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-[var(--accent-orange)]/50 hover:shadow-sm">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <span className="truncate font-semibold">
            {workflow.workflowName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRun}>
            <Play className="mr-1.5 h-3 w-3" />
            Run
          </Button>
          <Button asChild variant="outline" size="sm">
            <NavLink to={`/create-graph?workflowId=${workflow.id}`}>
              <Pencil className="mr-1.5 h-3 w-3" />
              Edit
            </NavLink>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${workflow.workflowName}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
