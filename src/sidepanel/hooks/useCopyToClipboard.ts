import { useState, useCallback } from 'react'

/**
 * Custom hook for copying text to clipboard with modern Clipboard API
 * Provides copy functionality with success/error state management
 */
export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      // Reset previous states
      setError(null)
      setIsCopied(false)

      // Check if Clipboard API is available
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not supported')
      }

      // Copy text to clipboard
      await navigator.clipboard.writeText(text)
      
      // Set success state
      setIsCopied(true)
      
      // Reset success state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000)
      
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy to clipboard'
      setError(errorMessage)
      
      // Reset error state after 3 seconds
      setTimeout(() => setError(null), 3000)
      
      return false
    }
  }, [])

  return {
    copyToClipboard,
    isCopied,
    error
  }
}
