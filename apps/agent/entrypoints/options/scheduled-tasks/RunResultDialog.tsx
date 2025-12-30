import { CheckCircle2, XCircle } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ScheduledJobRun } from './types'

interface RunResultDialogProps {
  run: ScheduledJobRun | null
  jobName?: string
  onOpenChange: (open: boolean) => void
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return 'Still running'
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const diffMs = end - start
  const diffSecs = Math.floor(diffMs / 1000)
  const mins = Math.floor(diffSecs / 60)
  const secs = diffSecs % 60
  if (mins === 0) return `${secs} seconds`
  return `${mins}m ${secs}s`
}

export const RunResultDialog: FC<RunResultDialogProps> = ({
  run,
  jobName,
  onOpenChange,
}) => {
  if (!run) return null

  return (
    <Dialog open={!!run} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {run.status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : run.status === 'failed' ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : null}
            {jobName || 'Run Result'}
          </DialogTitle>
          <div className="text-muted-foreground text-sm">
            {formatDateTime(run.startedAt)} •{' '}
            {formatDuration(run.startedAt, run.completedAt)}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {run.result || 'No result available'}
            </pre>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
