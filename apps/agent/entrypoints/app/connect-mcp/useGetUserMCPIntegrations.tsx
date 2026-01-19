import useSWR from 'swr'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

interface UserMCPIntegrationsList {
  integrations: {
    name: string
    is_authenticated: boolean
  }[]
  count: number
}

const getUserMCPIntegrations = async ([hostUrl]: [hostUrl: string]) => {
  const response = await fetch(`${hostUrl}/klavis/user-integrations`)
  const data = (await response.json()) as UserMCPIntegrationsList
  return data
}

export const useGetUserMCPIntegrations = () => {
  const { baseUrl: agentServerUrl } = useAgentServerUrl()

  return useSWR(
    agentServerUrl ? [agentServerUrl, 'klavis/user-integrations'] : null,
    getUserMCPIntegrations,
    {
      keepPreviousData: true,
      revalidateOnFocus: true,
    },
  )
}
