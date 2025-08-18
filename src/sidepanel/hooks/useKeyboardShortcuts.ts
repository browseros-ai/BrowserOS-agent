import { useEffect, useRef } from 'react'

interface KeyboardHandlers {
  onSubmit?: () => void
  onCancel?: () => void
  onNewline?: () => void
  onTabSelectorClose?: () => void
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  isProcessing?: boolean
  showTabSelector?: boolean
}

/**
 * Hook to handle keyboard shortcuts for the chat interface
 * Manages Enter, Shift+Enter, Escape, and other keyboard interactions
 */
export function useKeyboardShortcuts(
  handlers: KeyboardHandlers,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, isProcessing = false, showTabSelector = false } = options
  const handlersRef = useRef(handlers)
  
  // Update handlers ref to avoid stale closures
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])
  
  useEffect(() => {
    if (!enabled) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTextarea = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT'
      
      // Enter key handling
      if (e.key === 'Enter' && isTextarea) {
        if (e.shiftKey) {
          // Shift+Enter: Allow default behavior (new line)
          return
        } else {
          // Enter: Submit or interrupt
          e.preventDefault()
          
          // Don't submit if tab selector is open
          if (showTabSelector) return
          
          handlersRef.current.onSubmit?.()
        }
      }
      
      // Escape key handling
      if (e.key === 'Escape') {
        if (showTabSelector) {
          // Close tab selector first
          e.preventDefault()
          handlersRef.current.onTabSelectorClose?.()
        } else if (isProcessing) {
          // Cancel task if processing
          e.preventDefault()
          handlersRef.current.onCancel?.()
        }
      }
    }
    
    // Attach listener at document level to capture all events
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, isProcessing, showTabSelector])
}

// Additional hook for auto-resize behavior
export function useAutoResize(ref: React.RefObject<HTMLTextAreaElement>, value: string) {
  useEffect(() => {
    const textarea = ref.current
    if (!textarea) return
    
    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto'
    
    // Set height based on content with minimum
    const newHeight = Math.max(40, textarea.scrollHeight)
    textarea.style.height = `${newHeight}px`
  }, [value, ref])
  
  // Set initial height
  useEffect(() => {
    const textarea = ref.current
    if (textarea) {
      textarea.style.height = '40px'
    }
  }, [ref])
}