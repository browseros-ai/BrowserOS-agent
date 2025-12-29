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
  selectedIndex: number
  isLoading: boolean
  saveProvider: (provider: LlmHubProvider, editIndex?: number) => Promise<void>
  setSelectedIndex: (index: number) => Promise<void>
  deleteProvider: (index: number) => Promise<void>
}

/** @public */
export function useLlmHubProviders(): UseLlmHubProvidersReturn {
  const [providers, setProviders] = useState<LlmHubProvider[]>([])
  const [selectedIndex, setSelectedIndexState] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await loadProviders()
        setProviders(data.providers)
        setSelectedIndexState(data.selectedIndex)
      } catch {
        setProviders(DEFAULT_PROVIDERS)
        setSelectedIndexState(0)
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

      const success = await saveProviders(updatedProviders, selectedIndex)
      if (!success) setProviders(prev)
    },
    [providers, selectedIndex],
  )

  const setSelectedIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= providers.length) return

      const prev = selectedIndex
      setSelectedIndexState(index)

      const success = await saveProviders(providers, index)
      if (!success) setSelectedIndexState(prev)
    },
    [providers, selectedIndex],
  )

  const deleteProvider = useCallback(
    async (index: number) => {
      if (providers.length <= 1) return

      const updatedProviders = providers.filter((_, i) => i !== index)
      let newSelectedIndex = selectedIndex
      if (selectedIndex === index) {
        newSelectedIndex = 0
      } else if (selectedIndex > index) {
        newSelectedIndex = selectedIndex - 1
      }

      const prevProviders = providers
      const prevSelected = selectedIndex

      setProviders(updatedProviders)
      setSelectedIndexState(newSelectedIndex)

      const success = await saveProviders(updatedProviders, newSelectedIndex)
      if (!success) {
        setProviders(prevProviders)
        setSelectedIndexState(prevSelected)
      }
    },
    [providers, selectedIndex],
  )

  return {
    providers,
    selectedIndex,
    isLoading,
    saveProvider,
    setSelectedIndex,
    deleteProvider,
  }
}
