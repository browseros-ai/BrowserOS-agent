import { storage } from '@wxt-dev/storage'
import { getAgentServerUrl } from '@/lib/browseros/helpers'
import { mcpServerStorage } from './mcpServerStorage'

const MCP_MIGRATED_KEY = 'local:mcpMigratedToServer'

export async function migrateMcpToServer(): Promise<void> {
  const migrated = await storage.getItem<boolean>(MCP_MIGRATED_KEY)
  if (migrated) return

  const servers = await mcpServerStorage.getValue()
  if (!servers?.length) {
    await storage.setItem(MCP_MIGRATED_KEY, true)
    return
  }

  try {
    const agentServerUrl = await getAgentServerUrl()
    const response = await fetch(`${agentServerUrl}/mcp-config/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servers }),
    })

    if (response.ok) {
      await storage.setItem(MCP_MIGRATED_KEY, true)
    }
  } catch {
    // Server might not be running yet — retry on next startup
  }
}
