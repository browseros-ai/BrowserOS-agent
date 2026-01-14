import type { UIMessage } from 'ai'
import { Loader2, RotateCcw, Square, X } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface RunWorkflowDialogProps {
  open: boolean
  workflowName: string
  messages: UIMessage[]
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  wasCancelled: boolean
  error: Error | undefined
  onStop: () => void
  onRetry: () => void
  onClose: () => void
}

export const RunWorkflowDialog: FC<RunWorkflowDialogProps> = ({
  open,
  workflowName,
  messages,
  status,
  wasCancelled,
  error,
  onStop,
  onRetry,
  onClose,
}) => {
  const isProcessing = status === 'streaming' || status === 'submitted'
  const _isComplete = !isProcessing

  const getStatusText = () => {
    if (status === 'submitted') return 'Starting workflow...'
    if (status === 'streaming') return 'Running...'
    if (wasCancelled) return 'Execution cancelled'
    if (status === 'error') return 'Error occurred'
    return 'Completed'
  }

  const getMessageContent = (message: UIMessage) => {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
  }

  const assistantMessages = messages.filter((m) => m.role === 'assistant')

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-h-[80vh] max-w-2xl overflow-hidden [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-orange)]" />
            )}
            Running: {workflowName}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <Button variant="destructive" size="sm" onClick={onStop}>
                <Square className="mr-1.5 h-3 w-3" />
                Stop
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  Retry
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  <X className="mr-1.5 h-3 w-3" />
                  Close
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-sm">{getStatusText()}</div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
              <div className="font-medium">Error Details</div>
              <div className="mt-1 whitespace-pre-wrap font-mono text-xs">
                {error.message}
              </div>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
            {assistantMessages.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                {isProcessing
                  ? 'Waiting for response...'
                  : 'No output available.'}
              </div>
            ) : (
              <div className="space-y-4">
                {assistantMessages.map((message) => (
                  <div key={message.id} className="whitespace-pre-wrap text-sm">
                    {getMessageContent(message)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
