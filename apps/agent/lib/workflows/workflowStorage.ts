import { storage } from '@wxt-dev/storage'
import { useEffect, useState } from 'react'

export interface Workflow {
  id: string
  codeId: string
  workflowName: string
}

export const workflowStorage = storage.defineItem<Workflow[]>(
  'local:workflows',
  {
    fallback: [],
  },
)

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])

  useEffect(() => {
    workflowStorage.getValue().then(setWorkflows)
    const unwatch = workflowStorage.watch((newValue) => {
      setWorkflows(newValue ?? [])
    })
    return unwatch
  }, [])

  const addWorkflow = async (workflow: Omit<Workflow, 'id'>) => {
    const newWorkflow: Workflow = {
      id: crypto.randomUUID(),
      ...workflow,
    }
    const current = (await workflowStorage.getValue()) ?? []
    await workflowStorage.setValue([...current, newWorkflow])
    return newWorkflow
  }

  const removeWorkflow = async (id: string) => {
    const current = (await workflowStorage.getValue()) ?? []
    await workflowStorage.setValue(current.filter((w) => w.id !== id))
  }

  const editWorkflow = async (
    id: string,
    updates: Partial<Omit<Workflow, 'id'>>,
  ) => {
    const current = (await workflowStorage.getValue()) ?? []
    await workflowStorage.setValue(
      current.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    )
  }

  return { workflows, addWorkflow, removeWorkflow, editWorkflow }
}
