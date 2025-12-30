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
import { NewScheduledTaskDialog } from './NewScheduledTaskDialog'
import { RunResultDialog } from './RunResultDialog'
import { ScheduledTasksHeader } from './ScheduledTasksHeader'
import { ScheduledTasksList } from './ScheduledTasksList'
import {
  type ScheduledJob,
  type ScheduledJobRun,
  useScheduledTasks,
} from './useScheduledTasks'

/**
 * Main page for managing scheduled tasks
 * @public
 */
export const ScheduledTasksPage: FC = () => {
  const { jobs, isLoading, createJob, updateJob, deleteJob, getRunsForJob } =
    useScheduledTasks()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null)
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null)
  const [viewingRun, setViewingRun] = useState<ScheduledJobRun | null>(null)

  const handleAdd = () => {
    setEditingJob(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (job: ScheduledJob) => {
    setEditingJob(job)
    setIsDialogOpen(true)
  }

  const handleDelete = (jobId: string) => {
    setDeleteJobId(jobId)
  }

  const confirmDelete = async () => {
    if (deleteJobId) {
      await deleteJob(deleteJobId)
      setDeleteJobId(null)
    }
  }

  const handleSave = async (data: Omit<ScheduledJob, 'id' | 'createdAt'>) => {
    if (editingJob) {
      await updateJob(editingJob.id, data)
    } else {
      await createJob(data)
    }
  }

  const handleToggle = async (jobId: string, enabled: boolean) => {
    await updateJob(jobId, { enabled })
  }

  const handleViewRun = (run: ScheduledJobRun) => {
    setViewingRun(run)
  }

  const jobToDelete = deleteJobId
    ? jobs.find((j) => j.id === deleteJobId)
    : null

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <ScheduledTasksHeader onAddClick={handleAdd} />

      <ScheduledTasksList
        jobs={jobs}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onViewRun={handleViewRun}
        getRunsForJob={getRunsForJob}
      />

      <NewScheduledTaskDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialValues={editingJob}
        onSave={handleSave}
      />

      <RunResultDialog
        run={viewingRun}
        jobName={
          viewingRun
            ? jobs.find((j) => j.id === viewingRun.jobId)?.name
            : undefined
        }
        onOpenChange={(open) => !open && setViewingRun(null)}
      />

      <AlertDialog
        open={deleteJobId !== null}
        onOpenChange={(open) => !open && setDeleteJobId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{jobToDelete?.name}"? This will also remove all run
              history for this task.
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
