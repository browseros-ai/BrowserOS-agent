import type { AppType } from '@browseros/server'
import { hc } from 'hono/client'
import { getAgentServerUrl } from '../browseros/helpers'

export const getClient = async () => {
  const serverUrl = await getAgentServerUrl()
  return hc<AppType>(serverUrl)
}
