import { Plus, Workflow } from 'lucide-react'
import type { FC } from 'react'
import { NavLink } from 'react-router'
import { Button } from '@/components/ui/button'

export const WorkflowsHeader: FC = () => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
          <Workflow className="h-6 w-6 text-[var(--accent-orange)]" />
        </div>
        <div className="flex-1">
          <h2 className="mb-1 font-semibold text-xl">Workflows</h2>
          <p className="text-muted-foreground text-sm">
            Create and manage browser automation workflows
          </p>
        </div>
        <Button
          asChild
          className="border-[var(--accent-orange)] bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/20 hover:text-[var(--accent-orange)]"
          variant="outline"
        >
          <NavLink to="/create-graph">
            <Plus className="mr-1.5 h-4 w-4" />
            New Workflow
          </NavLink>
        </Button>
      </div>
    </div>
  )
}
