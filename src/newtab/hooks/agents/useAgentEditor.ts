import { useState, useCallback } from 'react'
import { z } from 'zod'
import { type Agent, AgentFormSchema, type AgentFormData } from '@/newtab/schemas/agent.schema'
import { type Template } from '@/newtab/schemas/template.schema'

interface UseAgentEditorReturn {
  // Form state
  name: string
  description: string
  goal: string
  steps: string[]
  notes: string[]
  
  // Field setters
  setName: (name: string) => void
  setDescription: (desc: string) => void
  setGoal: (goal: string) => void
  setSteps: (steps: string[]) => void
  setNotes: (notes: string[]) => void
  
  // Validation
  validate: () => z.SafeParseReturnType<AgentFormData, AgentFormData>
  errors: Record<string, string>
  setErrors: (errors: Record<string, string>) => void
  
  // Operations
  loadAgent: (agent: Agent) => void
  loadTemplate: (template: Template) => void
  resetForm: () => void
  getFormData: () => AgentFormData
}

export function useAgentEditor (): UseAgentEditorReturn {
  const [name, setName] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [goal, setGoal] = useState<string>('')
  const [steps, setSteps] = useState<string[]>([''])
  const [notes, setNotes] = useState<string[]>([''])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Validate form data
  const validate = useCallback((): z.SafeParseReturnType<AgentFormData, AgentFormData> => {
    const filteredSteps = steps.filter(s => s.trim().length > 0)
    const filteredNotes = notes.filter(n => n.trim().length > 0)
    
    return AgentFormSchema.safeParse({
      name,
      description,
      goal,
      steps: filteredSteps,
      notes: filteredNotes
    })
  }, [name, description, goal, steps, notes])

  // Load existing agent
  const loadAgent = useCallback((agent: Agent): void => {
    setName(agent.name)
    setDescription(agent.description)
    setGoal(agent.goal)
    setSteps(agent.steps.length > 0 ? agent.steps : [''])
    setNotes(agent.notes && agent.notes.length > 0 ? agent.notes : [''])
    setErrors({})
  }, [])

  // Load template
  const loadTemplate = useCallback((template: Template): void => {
    setName(template.name)
    setDescription(template.description || '')
    setGoal(template.goal)
    setSteps(template.steps.length > 0 ? template.steps : [''])
    setNotes(template.notes.length > 0 ? template.notes : [''])
    setErrors({})
  }, [])

  // Reset form
  const resetForm = useCallback((): void => {
    setName('')
    setDescription('')
    setGoal('')
    setSteps([''])
    setNotes([''])
    setErrors({})
  }, [])

  // Get form data
  const getFormData = useCallback((): AgentFormData => {
    return {
      name,
      description: description || undefined,
      goal,
      steps: steps.filter(s => s.trim().length > 0),
      notes: notes.filter(n => n.trim().length > 0)
    }
  }, [name, description, goal, steps, notes])

  return {
    name,
    description,
    goal,
    steps,
    notes,
    setName,
    setDescription,
    setGoal,
    setSteps,
    setNotes,
    validate,
    errors,
    setErrors,
    loadAgent,
    loadTemplate,
    resetForm,
    getFormData
  }
}