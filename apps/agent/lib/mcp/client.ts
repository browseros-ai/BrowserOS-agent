import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/** @public */
export interface McpTool {
  name: string
  description?: string
}

/**
 * Fetches available tools from an MCP server
 * @public
 */
export async function fetchMcpTools(serverUrl: string): Promise<McpTool[]> {
  const client = new Client({
    name: 'browseros-settings',
    version: '1.0.0',
  })

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl))

  try {
    await client.connect(transport)
    const response = await client.listTools()

    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }))
  } finally {
    await client.close()
  }
}
