import { useQuery } from '@tanstack/react-query'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

async function fetchSoul(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/soul`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  return data.content || ''
}

export function useSoulContent() {
  const { baseUrl, isLoading: urlLoading } = useAgentServerUrl()

  const { data, isLoading, error } = useQuery<string, Error>({
    queryKey: ['soul', baseUrl],
    queryFn: () => fetchSoul(baseUrl as string),
    enabled: !!baseUrl && !urlLoading,
  })

  return {
    content: data ?? null,
    isLoading: isLoading || urlLoading,
    error,
  }
}
