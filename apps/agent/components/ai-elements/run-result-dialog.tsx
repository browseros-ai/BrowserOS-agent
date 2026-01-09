import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  XCircle,
} from 'lucide-react'
import { type FC, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ScheduledJobRun } from '@/lib/schedules/scheduleTypes'
import { MessageResponse } from './message'

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

function getDisplayContent(run: ScheduledJobRun): {
  hasStructuredData: boolean
  finalResult?: string
  executionLog?: string
  legacyContent?: string
} {
  if (run.finalResult || run.executionLog) {
    return {
      hasStructuredData: true,
      finalResult: run.finalResult,
      executionLog: run.executionLog,
    }
  }

  return {
    hasStructuredData: false,
    legacyContent: run.result,
  }
}

export const RunResultDialog: FC<RunResultDialogProps> = ({
  run,
  jobName,
  onOpenChange,
}) => {
  const [copied, setCopied] = useState(false)
  const [executionLogOpen, setExecutionLogOpen] = useState(false)

  const content = useMemo(() => {
    if (!run) return null
    return getDisplayContent(run)
  }, [run])

  const handleCopy = async () => {
    if (!run) return
    const textToCopy = run.finalResult || run.result || ''
    if (!textToCopy) return
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!run) return null

  return (
    <Dialog open={!!run} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
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

        <ScrollArea className="max-h-[70vh]">
          <div className="flex flex-col gap-4 pr-4">
            {run.status === 'failed' && run.result ? (
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium text-sm">Task failed</span>
                </div>
                <p className="text-destructive text-sm">{run.result}</p>
              </div>
            ) : content?.hasStructuredData ? (
              <>
                {content.finalResult && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <MessageResponse>{content.finalResult}</MessageResponse>
                  </div>
                )}

                {content.executionLog && (
                  <Collapsible
                    open={executionLogOpen}
                    onOpenChange={setExecutionLogOpen}
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
                      <span className="font-medium text-sm">Execution Log</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${executionLogOpen ? 'rotate-180' : ''}`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <MessageResponse>
                          {content.executionLog}
                        </MessageResponse>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </>
            ) : content?.legacyContent ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <MessageResponse>{content.legacyContent}</MessageResponse>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-muted-foreground text-sm">
                No result available
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          {(run.finalResult || run.result) && (
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
