import { type FC, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  WORKFLOW_DELETED_EVENT,
  WORKFLOW_RUN_STARTED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { useRpcClient } from '@/lib/rpc/RpcClientProvider'
import { sentry } from '@/lib/sentry/sentry'
import { useWorkflows } from '@/lib/workflows/workflowStorage'
import { RunWorkflowDialog } from './RunWorkflowDialog'
import { useRunWorkflow } from './useRunWorkflow'
import { WorkflowsHeader } from './WorkflowsHeader'
import { WorkflowsList } from './WorkflowsList'

export const WorkflowsPage: FC = () => {
  const { workflows, removeWorkflow } = useWorkflows()
  const rpcClient = useRpcClient()

  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null)

  const {
    isRunning,
    runningWorkflowName,
    messages,
    status,
    wasCancelled,
    error,
    runWorkflow,
    stopRun,
    retry,
    closeDialog,
  } = useRunWorkflow()

  const handleDelete = (workflowId: string) => {
    setDeleteWorkflowId(workflowId)
  }

  const confirmDelete = async () => {
    if (!deleteWorkflowId) return

    const workflow = workflows.find((w) => w.id === deleteWorkflowId)
    if (!workflow) return

    try {
      await rpcClient.graph[':id'].$delete({ param: { id: workflow.codeId } })
    } catch (error) {
      sentry.captureException(error, {
        extra: {
          message: 'Failed to delete graph from server',
          codeId: workflow.codeId,
          workflowId: deleteWorkflowId,
        },
      })
    }

    await removeWorkflow(deleteWorkflowId)
    setDeleteWorkflowId(null)
    track(WORKFLOW_DELETED_EVENT)
  }

  const handleRun = (workflowId: string) => {
    const workflow = workflows.find((w) => w.id === workflowId)
    if (workflow) {
      track(WORKFLOW_RUN_STARTED_EVENT)
      runWorkflow(workflow.codeId, workflow.workflowName)
    }
  }

  const workflowToDelete = deleteWorkflowId
    ? workflows.find((w) => w.id === deleteWorkflowId)
    : null

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <WorkflowsHeader />

      <WorkflowsList
        workflows={workflows}
        onDelete={handleDelete}
        onRun={handleRun}
      />

      <AlertDialog
        open={deleteWorkflowId !== null}
        onOpenChange={(open) => !open && setDeleteWorkflowId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{workflowToDelete?.workflowName}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RunWorkflowDialog
        open={isRunning}
        workflowName={runningWorkflowName}
        messages={messages}
        status={status}
        wasCancelled={wasCancelled}
        error={error}
        onStop={stopRun}
        onRetry={retry}
        onClose={closeDialog}
      />
    </div>
  )
}
