import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

async function fetchMemory(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/memory`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  return data.content || ''
}

async function saveMemory(baseUrl: string, content: string): Promise<void> {
  const response = await fetch(`${baseUrl}/memory`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
}

export function useMemoryContent() {
  const { baseUrl, isLoading: urlLoading } = useAgentServerUrl()
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<string, Error>({
    queryKey: ['memory', baseUrl],
    queryFn: () => fetchMemory(baseUrl as string),
    enabled: !!baseUrl && !urlLoading,
  })

  const saveMutation = useMutation({
    mutationFn: (content: string) => saveMemory(baseUrl as string, content),
    onSuccess: (_data, content) => {
      queryClient.setQueryData(['memory', baseUrl], content)
    },
  })

  return {
    content: data ?? null,
    isLoading: isLoading || urlLoading,
    error,
    refetch,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
  }
}
