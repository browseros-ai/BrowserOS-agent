import { useCallback } from 'react'
import { z } from 'zod'
import { AgentFormSchema, type AgentFormData } from '@/newtab/schemas/agent.schema'

interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  data?: AgentFormData
}

export function useAgentValidation () {
  const validateForm = useCallback((formData: Partial<AgentFormData>): ValidationResult => {
    try {
      const validated = AgentFormSchema.parse(formData)
      return {
        isValid: true,
        errors: {},
        data: validated
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach(issue => {
          const key = String(issue.path[0])
          fieldErrors[key] = issue.message
        })
        return {
          isValid: false,
          errors: fieldErrors
        }
      }
      return {
        isValid: false,
        errors: { general: 'Validation failed' }
      }
    }
  }, [])

  return { validateForm }
}