import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

export interface DailyMemoryFile {
  fileName: string
  date: string
  content: string
}

export interface MemorySnapshot {
  coreMemory: string
  dailyMemories: DailyMemoryFile[]
  retentionDays: number
}

const MEMORY_QUERY_KEY = 'memory'

async function fetchMemory(baseUrl: string): Promise<MemorySnapshot> {
  const response = await fetch(`${baseUrl}/memory`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function updateCoreMemory(baseUrl: string, content: string) {
  const response = await fetch(`${baseUrl}/memory/core`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${response.status}`)
  }
}

export function useMemory() {
  const {
    baseUrl,
    isLoading: urlLoading,
    error: urlError,
  } = useAgentServerUrl()
  const queryClient = useQueryClient()
  const queryKey = [MEMORY_QUERY_KEY, baseUrl]

  const { data, isLoading, error, refetch } = useQuery<MemorySnapshot, Error>({
    queryKey,
    queryFn: () => fetchMemory(baseUrl as string),
    enabled: !!baseUrl && !urlLoading,
  })

  const saveCoreMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!baseUrl) throw new Error('BrowserOS server URL is unavailable')
      await updateCoreMemory(baseUrl, content)
      return content
    },
    onSuccess: (content) => {
      queryClient.setQueryData<MemorySnapshot | undefined>(
        queryKey,
        (current) => (current ? { ...current, coreMemory: content } : current),
      )
    },
  })

  return {
    memory: data ?? null,
    isLoading: isLoading || urlLoading,
    error: error ?? urlError,
    refetch,
    saveCoreMemory: saveCoreMutation.mutateAsync,
    isSavingCore: saveCoreMutation.isPending,
  }
}
