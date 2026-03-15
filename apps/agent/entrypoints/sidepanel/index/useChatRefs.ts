import { useEffect, useRef } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import type { LlmProviderConfig } from '@/lib/llm-providers/types'
import { useLlmProviders } from '@/lib/llm-providers/useLlmProviders'
import { usePersonalization } from '@/lib/personalization/personalizationStorage'

export const useChatRefs = () => {
  const {
    selectedProvider: selectedLlmProvider,
    isLoading: isLoadingProviders,
  } = useLlmProviders()
  const { personalization } = usePersonalization()

  const selectedLlmProviderRef = useRef<LlmProviderConfig | null>(
    selectedLlmProvider,
  )
  const personalizationRef = useRef(personalization)

  useDeepCompareEffect(() => {
    selectedLlmProviderRef.current = selectedLlmProvider
  }, [selectedLlmProvider ?? {}])

  useEffect(() => {
    personalizationRef.current = personalization
  }, [personalization])

  return {
    selectedLlmProviderRef,
    personalizationRef,
    selectedLlmProvider,
    isLoadingProviders,
  }
}
