import { useEffect, useState, useRef } from 'react'
import { z } from 'zod'
import { AgentDraftSchema, type AgentDraft } from '@/newtab/schemas/editor.schema'

const DEFAULT_DEBOUNCE_MS = 600
const DEFAULT_STORAGE_KEY = 'agent-draft'

interface UseAutoSaveOptions {
  data: AgentDraft
  enabled: boolean
  debounceMs?: number
  storageKey?: string
}

interface UseAutoSaveReturn {
  lastSaved: Date | null
  isAutoSaving: boolean
  clearDraft: () => void
  loadDraft: () => AgentDraft | null
}

export function useAutoSave (options: UseAutoSaveOptions): UseAutoSaveReturn {
  const { 
    data, 
    enabled, 
    debounceMs = DEFAULT_DEBOUNCE_MS,
    storageKey = DEFAULT_STORAGE_KEY
  } = options
  
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  // Save draft to localStorage
  useEffect(() => {
    if (!enabled) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set auto-saving flag and debounce save
    setIsAutoSaving(true)
    saveTimeoutRef.current = setTimeout(() => {
      try {
        // Validate data before saving
        const validated = AgentDraftSchema.parse(data)
        localStorage.setItem(storageKey, JSON.stringify(validated))
        setLastSaved(new Date())
      } catch (error) {
        console.error('Failed to save draft:', error)
      } finally {
        setIsAutoSaving(false)
      }
    }, debounceMs)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [data, enabled, debounceMs, storageKey])

  // Clear draft from localStorage
  const clearDraft = (): void => {
    localStorage.removeItem(storageKey)
    setLastSaved(null)
  }

  // Load draft from localStorage
  const loadDraft = (): AgentDraft | null => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      
      const parsed = JSON.parse(raw)
      return AgentDraftSchema.parse(parsed)
    } catch {
      // Invalid draft, clear it
      clearDraft()
      return null
    }
  }

  return {
    lastSaved,
    isAutoSaving,
    clearDraft,
    loadDraft
  }
}