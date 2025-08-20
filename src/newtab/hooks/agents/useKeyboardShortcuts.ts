import { useEffect } from 'react'

interface UseKeyboardShortcutsOptions {
  onSave?: () => void
  onRun?: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts (options: UseKeyboardShortcutsOptions): void {
  const { onSave, /* onRun, */ enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      const isCmd = e.metaKey || e.ctrlKey
      
      // Cmd/Ctrl + S to save
      if (isCmd && e.key.toLowerCase() === 's' && onSave) {
        e.preventDefault()
        onSave()
      }
      
      // Run shortcut removed intentionally
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave, enabled])
}
