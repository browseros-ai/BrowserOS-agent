import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import { sentry } from '@/lib/sentry/sentry'

interface CoreMemoryResponse {
  content: string
  exists: boolean
  updatedAt: string | null
}

const getCoreMemoryQueryKey = (baseUrl: string | null) => [
  'core-memory',
  baseUrl,
]

async function fetchCoreMemory(baseUrl: string): Promise<CoreMemoryResponse> {
  const response = await fetch(`${baseUrl}/memory/core`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function saveCoreMemory(
  baseUrl: string,
  content: string,
): Promise<CoreMemoryResponse> {
  const response = await fetch(`${baseUrl}/memory/core`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export function useCoreMemory() {
  const {
    baseUrl,
    isLoading: urlLoading,
    error: urlError,
  } = useAgentServerUrl()
  const queryClient = useQueryClient()

  const query = useQuery<CoreMemoryResponse, Error>({
    queryKey: getCoreMemoryQueryKey(baseUrl),
    queryFn: () => fetchCoreMemory(baseUrl as string),
    enabled: !!baseUrl && !urlLoading,
  })

  const mutation = useMutation({
    mutationFn: (content: string) => saveCoreMemory(baseUrl as string, content),
    onSuccess: (memory) => {
      queryClient.setQueryData(getCoreMemoryQueryKey(baseUrl), memory)
    },
    onError: (error) => {
      sentry.captureException(error, {
        extra: {
          message: 'Failed to save core memory from sidepanel',
        },
      })
    },
  })

  return {
    memory: query.data ?? null,
    isLoading: query.isLoading || urlLoading,
    error: urlError ?? query.error,
    refetch: query.refetch,
    saveMemory: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}
