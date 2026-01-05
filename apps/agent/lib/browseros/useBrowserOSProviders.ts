import { useEffect, useState } from 'react'
import { getAgentServerUrl } from './helpers'
import { useCapabilities } from './useCapabilities'

interface UseAgentServerUrlResult {
  baseUrl: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * @public
 */
export function useAgentServerUrl(): UseAgentServerUrlResult {
  const { isLoading: capabilitiesLoading } = useCapabilities()
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (capabilitiesLoading) return

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
  }, [capabilitiesLoading])

  return { baseUrl, isLoading: isLoading || capabilitiesLoading, error }
}
