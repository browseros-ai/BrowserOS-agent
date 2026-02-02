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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  NEW_SCHEDULED_TASK_CREATED_EVENT,
  SCHEDULED_TASK_DELETED_EVENT,
  SCHEDULED_TASK_EDITED_EVENT,
  SCHEDULED_TASK_TESTED_EVENT,
  SCHEDULED_TASK_TOGGLED_EVENT,
  SCHEDULED_TASK_VIEW_RESULTS_EVENT,
} from '@/lib/constants/analyticsEvents'
import { useGraphqlMutation } from '@/lib/graphql/useGraphqlMutation'
import { track } from '@/lib/metrics/track'
import { DeleteScheduledJobDocument } from '@/lib/schedules/graphql/syncSchedulesDocument'
import { useScheduledJobs } from '@/lib/schedules/scheduleStorage'
import type { ScheduledJobRun } from '@/lib/schedules/scheduleTypes'
import { NewScheduledTaskDialog } from './NewScheduledTaskDialog'
import { ScheduledTaskResults } from './ScheduledTaskResults'
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

  const deleteRemoteJobMutation = useGraphqlMutation(DeleteScheduledJobDocument)

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
      deleteRemoteJobMutation.mutate({ rowId: deleteJobId })
      setDeleteJobId(null)
      track(SCHEDULED_TASK_DELETED_EVENT)
    }
  }

  const handleSave = async (
    data: Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (editingJob) {
      await editJob(editingJob.id, data)
      track(SCHEDULED_TASK_EDITED_EVENT, {
        scheduleType: data.scheduleType,
        interval: data.scheduleInterval,
        time: data.scheduleTime,
      })
    } else {
      await addJob(data)
      track(NEW_SCHEDULED_TASK_CREATED_EVENT, {
        scheduleType: data.scheduleType,
        interval: data.scheduleInterval,
        time: data.scheduleTime,
      })
    }
  }

  const handleToggle = async (jobId: string, enabled: boolean) => {
    await toggleJob(jobId, enabled)
    track(SCHEDULED_TASK_TOGGLED_EVENT)
  }

  const handleRun = async (jobId: string) => {
    await runJob(jobId)
    track(SCHEDULED_TASK_TESTED_EVENT)
  }

  const handleViewRun = (run: ScheduledJobRun) => {
    setViewingRun(run)
    track(SCHEDULED_TASK_VIEW_RESULTS_EVENT)
  }

  const jobToDelete = deleteJobId
    ? jobs.find((j) => j.id === deleteJobId)
    : null

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <ScheduledTasksHeader onAddClick={handleAdd} />

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="tasks">Scheduled Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <ScheduledTaskResults onViewRun={handleViewRun} />
        </TabsContent>

        <TabsContent value="tasks">
          <ScheduledTasksList
            jobs={jobs}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onRun={handleRun}
            onViewRun={handleViewRun}
          />
        </TabsContent>
      </Tabs>

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
