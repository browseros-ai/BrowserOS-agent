import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { z } from 'zod'
import { AgentEditorForm } from './AgentEditorForm'
import { type Agent, CreateAgentSchema } from '@/newtab/schemas/agent.schema'
import { type Template } from '@/newtab/schemas/template.schema'
import { useAgentEditor } from '@/newtab/hooks/agents/useAgentEditor'
import { useAutoSave } from '@/newtab/hooks/agents/useAutoSave'
import { useKeyboardShortcuts } from '@/newtab/hooks/agents/useKeyboardShortcuts'

interface AgentEditorProps {
  agentId: string | null
  agent?: Agent | null
  template?: Template | null
  onSave: (data: any) => void
  onRun: () => Promise<void>
  onPlanChange?: (plan: { goal: string, steps: string[] }) => void
}

const DEFAULT_DESCRIPTION = ''

export type AgentEditorHandle = {
  setName: (name: string) => void
  getName: () => string
  setSteps: (steps: string[]) => void
  getSteps: () => string[]
  setGoal: (goal: string) => void
  getGoal: () => string
  save: () => void
  applyPlan: (plan: { goal: string, steps: string[] }, options?: { save?: boolean }) => void
  appendSteps: (steps: string[], options?: { save?: boolean }) => void
}

export const AgentEditor = forwardRef<AgentEditorHandle, AgentEditorProps>(function AgentEditor (
  { agentId, agent, template, onSave, onRun, onPlanChange }: AgentEditorProps,
  ref
) {
  const editor = useAgentEditor()
  const [notification, setNotification] = useState<string>('')
  const [queuedSaveAfterPlan, setQueuedSaveAfterPlan] = useState<boolean>(false)
  
  // Load agent or template when provided
  useEffect(() => {
    if (agent) {
      editor.loadAgent(agent)
      setNotification('')
    } else if (template) {
      editor.loadTemplate(template)
      setNotification('Save to enable Run')
    } else if (!agentId) {
      // New agent: ensure a truly fresh form
      editor.resetForm()
      setNotification('Save to enable Run')
    }
  }, [agent, template, agentId])

  // Auto-save functionality
  const { clearDraft, loadDraft } = useAutoSave({
    data: {
      name: editor.name,
      description: editor.description,
      goal: editor.goal,
      steps: editor.steps,
      notes: editor.notes
    },
    enabled: !agentId,  // Only auto-save for new agents
    debounceMs: 600
  })

  // Load draft on mount for new agents
  useEffect(() => {
    if (!agentId && !agent && !template) {
      const draft = loadDraft()
      if (draft) {
        editor.setName(draft.name)
        editor.setDescription(draft.description)
        editor.setGoal(draft.goal)
        editor.setSteps(draft.steps.length > 0 ? draft.steps : [''])
        editor.setNotes(draft.notes.length > 0 ? draft.notes : [''])
      }
    }
  }, [])

  // Handle save
  const handleSave = (): void => {
    editor.setErrors({})
    const filteredSteps = editor.steps.filter(s => s.trim().length > 0)
    const filteredNotes = editor.notes.filter(n => n.trim().length > 0)
    
    try {
      const payload = CreateAgentSchema.parse({
        name: editor.name,
        description: editor.description,
        goal: editor.goal,
        steps: filteredSteps,
        notes: filteredNotes
      })
      
      onSave({
        ...payload,
        description: payload.description ?? DEFAULT_DESCRIPTION,
        notes: filteredNotes
      })
      
      // Clear draft after successful save
      clearDraft()
      
      // Show saved notification
      setNotification('Saved')
      setTimeout(() => setNotification(''), 2500)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        err.errors.forEach(issue => {
          const key = String(issue.path[0])
          fieldErrors[key] = issue.message
        })
        editor.setErrors(fieldErrors)
      }
    }
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSave,
    // Run shortcut removed per requirements
    onRun: undefined
  })

  // Notify parent when plan (goal/steps) changes so PlanGenerator can refresh
  useEffect(() => {
    if (onPlanChange) {
      onPlanChange({ goal: editor.goal, steps: editor.steps })
    }
  }, [editor.goal, editor.steps])

  // If a plan was applied/steps appended with save requested, save once state is updated
  useEffect(() => {
    if (queuedSaveAfterPlan) {
      // Ensure we save after the latest goal/steps are applied
      handleSave()
      setQueuedSaveAfterPlan(false)
    }
  }, [queuedSaveAfterPlan, editor.goal, editor.steps])

  // Expose minimal imperative API for external helpers (e.g., PlanGenerator)
  useImperativeHandle(ref, () => ({
    setName: (name: string) => {
      editor.setName(name)
    },
    getName: () => editor.name,
    setSteps: (steps: string[]) => {
      editor.setSteps(steps.length > 0 ? steps : [''])
    },
    getSteps: () => editor.steps,
    setGoal: (goal: string) => {
      editor.setGoal(goal)
    },
    getGoal: () => editor.goal,
    save: () => handleSave(),
    applyPlan: (plan: { goal: string, steps: string[] }, options?: { save?: boolean }) => {
      editor.setGoal(plan.goal)
      editor.setSteps(plan.steps && plan.steps.length > 0 ? plan.steps : [''])
      if (options?.save) setQueuedSaveAfterPlan(true)
    },
    appendSteps: (steps: string[], options?: { save?: boolean }) => {
      const current = editor.steps || []
      const next = [...current, ...steps]
      editor.setSteps(next.length > 0 ? next : [''])
      if (options?.save) setQueuedSaveAfterPlan(true)
    }
  }))

  return (
    <>
      <button data-save-trigger style={{ display: 'none' }} onClick={handleSave} />
      <AgentEditorForm
        name={editor.name}
        description={editor.description}
        goal={editor.goal}
        steps={editor.steps}
        notes={editor.notes}
        errors={editor.errors}
        onNameChange={editor.setName}
        onDescriptionChange={editor.setDescription}
        onGoalChange={editor.setGoal}
        onStepsChange={editor.setSteps}
        onNotesChange={editor.setNotes}
      />
    </>
  )
})
