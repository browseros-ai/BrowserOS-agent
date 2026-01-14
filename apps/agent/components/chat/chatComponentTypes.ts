import type { ProviderType } from '@/lib/llm-providers/types'

export interface Provider {
  id: string
  name: string
  type: ProviderType
}
