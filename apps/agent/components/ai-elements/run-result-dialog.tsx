import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import DOMPurify from 'dompurify'
import { Check, CheckCircle2, Copy, Loader2, XCircle } from 'lucide-react'
import { marked } from 'marked'
import { type FC, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ScheduledJobRun } from '@/lib/schedules/scheduleTypes'

dayjs.extend(duration)

interface RunResultDialogProps {
  run: ScheduledJobRun | null
  jobName?: string
  onOpenChange: (open: boolean) => void
}

const formatDateTime = (dateStr: string) =>
  dayjs(dateStr).format('MMM D, YYYY, h:mm A')

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return 'Still running'
  const diff = dayjs(completedAt).diff(dayjs(startedAt))
  const d = dayjs.duration(diff)
  const mins = Math.floor(d.asMinutes())
  const secs = d.seconds()
  if (mins === 0) return `${secs} seconds`
  return `${mins}m ${secs}s`
}

export const RunResultDialog: FC<RunResultDialogProps> = ({
  run,
  jobName,
  onOpenChange,
}) => {
  const [copied, setCopied] = useState(false)

  const renderedContent = useMemo(() => {
    if (!run?.result) return null
    const html = marked.parse(run.result, { async: false }) as string
    return DOMPurify.sanitize(html)
  }, [run?.result])

  const handleCopy = async () => {
    if (!run?.result) return
    await navigator.clipboard.writeText(run.result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-accent-orange" />
            )}
            {jobName || 'Run Result'}
          </DialogTitle>
          <div className="text-muted-foreground text-sm">
            {formatDateTime(run.startedAt)} •{' '}
            {formatDuration(run.startedAt, run.completedAt)}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-100">
          {renderedContent ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-muted/50 p-4"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: renderedContent is sanitized with DOMPurify
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-muted-foreground text-sm">
              No result available
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {run.result && (
            <Button
              variant="outline"
              onClick={handleCopy}
              className="mr-2 sm:mr-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
