import { env } from '@/lib/env'
import { getBrowserOSAdapter } from './adapter'
import { BROWSEROS_PREFS } from './prefs'

export class AgentPortError extends Error {
  constructor() {
    super('Agent server port not configured.')
    this.name = 'AgentPortError'
  }
}

export class McpPortError extends Error {
  constructor() {
    super('MCP server port not configured.')
    this.name = 'McpPortError'
  }
}

/**
 * @public
 */
export async function getAgentServerUrl(): Promise<string> {
  const port = await getAgentPort()
  return `http://127.0.0.1:${port}`
}

async function getAgentPort(): Promise<number> {
  if (env.VITE_BROWSEROS_AGENT_PORT) {
    return env.VITE_BROWSEROS_AGENT_PORT
  }

  try {
    const adapter = getBrowserOSAdapter()
    const pref = await adapter.getPref(BROWSEROS_PREFS.AGENT_PORT)

    if (pref?.value && typeof pref.value === 'number') {
      return pref.value
    }
  } catch {
    // BrowserOS API not available
  }

  throw new AgentPortError()
}

async function getMcpPort(): Promise<number> {
  try {
    const adapter = getBrowserOSAdapter()
    const pref = await adapter.getPref(BROWSEROS_PREFS.MCP_PORT)

    if (pref?.value && typeof pref.value === 'number') {
      return pref.value
    }
  } catch {
    // BrowserOS API not available
  }

  throw new McpPortError()
}

/**
 * @public
 */
export async function getMcpServerUrl(): Promise<string> {
  const port = await getMcpPort()
  return `http://127.0.0.1:${port}/mcp`
}

/**
 * @public
 */
export async function getHealthCheckUrl(): Promise<string> {
  const port = await getMcpPort()
  return `http://127.0.0.1:${port}/health`
}
