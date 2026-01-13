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
import { useWorkflows } from '@/lib/workflows/workflowStorage'
import { WorkflowsHeader } from './WorkflowsHeader'
import { WorkflowsList } from './WorkflowsList'

export const WorkflowsPage: FC = () => {
  const { workflows, removeWorkflow } = useWorkflows()

  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null)

  const handleDelete = (workflowId: string) => {
    setDeleteWorkflowId(workflowId)
  }

  const confirmDelete = async () => {
    if (deleteWorkflowId) {
      await removeWorkflow(deleteWorkflowId)
      setDeleteWorkflowId(null)
    }
  }

  const handleRun = async (_workflowId: string) => {}

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
    </div>
  )
}
