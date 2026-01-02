import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PROVIDERS,
  type LlmHubProvider,
  loadProviders,
  saveProviders,
} from './storage'

/** @public */
export interface UseLlmHubProvidersReturn {
  providers: LlmHubProvider[]
  isLoading: boolean
  saveProvider: (provider: LlmHubProvider, editIndex?: number) => Promise<void>
  deleteProvider: (index: number) => Promise<void>
}

/** @public */
export function useLlmHubProviders(): UseLlmHubProvidersReturn {
  const [providers, setProviders] = useState<LlmHubProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await loadProviders()
        setProviders(data)
      } catch {
        setProviders(DEFAULT_PROVIDERS)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const saveProvider = useCallback(
    async (provider: LlmHubProvider, editIndex?: number) => {
      const isEdit = editIndex !== undefined && editIndex >= 0
      const updatedProviders = isEdit
        ? providers.map((p, i) => (i === editIndex ? provider : p))
        : [...providers, provider]

      const prev = providers
      setProviders(updatedProviders)

      const success = await saveProviders(updatedProviders)
      if (!success) setProviders(prev)
    },
    [providers],
  )

  const deleteProvider = useCallback(
    async (index: number) => {
      if (providers.length <= 1) return

      const updatedProviders = providers.filter((_, i) => i !== index)
      const prev = providers

      setProviders(updatedProviders)

      const success = await saveProviders(updatedProviders)
      if (!success) setProviders(prev)
    },
    [providers],
  )

  return {
    providers,
    isLoading,
    saveProvider,
    deleteProvider,
  }
}
