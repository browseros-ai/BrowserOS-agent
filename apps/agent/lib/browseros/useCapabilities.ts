import { useEffect, useState } from 'react'
import { Capabilities, type Feature } from './capabilities'

interface UseCapabilitiesResult {
  supports: (feature: Feature) => boolean
  isLoading: boolean
  osVersion: string | null
}

/**
 * React hook for version-gated feature checks.
 * Initializes Capabilities on first use and provides a sync `supports` function.
 *
 * @example
 * const { supports, isLoading } = useCapabilities()
 *
 * if (isLoading) return <Spinner />
 * if (supports(Feature.NEW_SIDEBAR)) return <NewSidebar />
 *
 * @public
 */
export function useCapabilities(): UseCapabilitiesResult {
  const [isLoading, setIsLoading] = useState(!Capabilities.isInitialized())
  const [osVersion, setOsVersion] = useState<string | null>(
    Capabilities.getOsVersion(),
  )

  useEffect(() => {
    if (Capabilities.isInitialized()) {
      setIsLoading(false)
      setOsVersion(Capabilities.getOsVersion())
      return
    }

    let cancelled = false

    async function init() {
      await Capabilities.initialize()
      if (!cancelled) {
        setOsVersion(Capabilities.getOsVersion())
        setIsLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  const supports = (feature: Feature): boolean => {
    if (!Capabilities.isInitialized()) return false
    return Capabilities.supports(feature)
  }

  return { supports, isLoading, osVersion }
}
