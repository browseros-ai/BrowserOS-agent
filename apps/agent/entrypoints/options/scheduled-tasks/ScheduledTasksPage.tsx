import { type FC, useState } from 'react'
import { RunResultDialog } from '@/components/ai-elements/run-result-dialog'
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
import { useScheduledJobs } from '@/lib/schedules/scheduleStorage'
import type { ScheduledJobRun } from '@/lib/schedules/scheduleTypes'
import { NewScheduledTaskDialog } from './NewScheduledTaskDialog'
import { ScheduledTasksHeader } from './ScheduledTasksHeader'
import { ScheduledTasksList } from './ScheduledTasksList'
import type { ScheduledJob } from './types'

/**
 * Main page for managing scheduled tasks
 * @public
 */
export const ScheduledTasksPage: FC = () => {
  const { jobs, addJob, editJob, toggleJob, removeJob, runJob } =
    useScheduledJobs()

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
      await removeJob(deleteJobId)
      setDeleteJobId(null)
    }
  }

  const handleSave = async (data: Omit<ScheduledJob, 'id' | 'createdAt'>) => {
    if (editingJob) {
      await editJob(editingJob.id, data)
    } else {
      await addJob(data)
    }
  }

  const handleToggle = async (jobId: string, enabled: boolean) => {
    await toggleJob(jobId, enabled)
  }

  const handleRun = async (jobId: string) => {
    await runJob(jobId)
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
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onRun={handleRun}
        onViewRun={handleViewRun}
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
