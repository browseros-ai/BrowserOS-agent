import { useEffect, useState } from 'react'
import { getAgentServerUrl } from './helpers'

interface UseAgentServerUrlResult {
  baseUrl: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * @public
 */
export function useAgentServerUrl(): UseAgentServerUrlResult {
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUrl() {
      try {
        const url = await getAgentServerUrl()
        if (!cancelled) {
          setBaseUrl(url)
          setIsLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)))
          setIsLoading(false)
        }
      }
    }

    loadUrl()

    return () => {
      cancelled = true
    }
  }, []) // Empty dependency array - only run once on mount

  return { baseUrl, isLoading, error }
}
