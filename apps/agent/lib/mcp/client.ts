import type { ListToolsResult } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod/v4'

/** @public */
export interface McpTool {
  name: string
  description?: string
}

const MCP_CLIENT_INFO = {
  name: 'browseros-settings',
  version: '1.0.0',
} as const

type McpClientConstructor =
  typeof import('@modelcontextprotocol/sdk/client/index.js').Client
type McpListToolsResultSchema =
  typeof import('@modelcontextprotocol/sdk/types.js').ListToolsResultSchema
type McpTransportConstructor =
  typeof import('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransport

interface McpSdk {
  Client: McpClientConstructor
  ListToolsResultSchema: McpListToolsResultSchema
  StreamableHTTPClientTransport: McpTransportConstructor
}

let mcpSdkPromise: Promise<McpSdk> | undefined

async function loadMcpSdk(): Promise<McpSdk> {
  if (!mcpSdkPromise) {
    mcpSdkPromise = (async () => {
      const previousJitless = z.config().jitless

      // Zod v4 captures JIT settings when schemas are constructed, so this has
      // to be set before the SDK modules create their schemas.
      z.config({ jitless: true })

      try {
        const [clientModule, transportModule, typesModule] = await Promise.all([
          import('@modelcontextprotocol/sdk/client/index.js'),
          import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
          import('@modelcontextprotocol/sdk/types.js'),
        ])

        return {
          Client: clientModule.Client,
          StreamableHTTPClientTransport:
            transportModule.StreamableHTTPClientTransport,
          ListToolsResultSchema: typesModule.ListToolsResultSchema,
        }
      } finally {
        z.config({ jitless: previousJitless })
      }
    })()
  }

  return mcpSdkPromise
}

function normalizeTools(tools: ListToolsResult['tools']): McpTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }))
}

async function listTools(
  client: InstanceType<McpClientConstructor>,
  listToolsResultSchema: McpListToolsResultSchema,
): Promise<McpTool[]> {
  const tools: McpTool[] = []
  let cursor: string | undefined

  do {
    const response: ListToolsResult = await client.request(
      {
        method: 'tools/list',
        ...(cursor ? { params: { cursor } } : {}),
      },
      listToolsResultSchema,
    )

    tools.push(...normalizeTools(response.tools))
    cursor = response.nextCursor
  } while (cursor)

  return tools
}

/**
 * Fetches available tools from an MCP server
 * @public
 */
export async function fetchMcpTools(serverUrl: string): Promise<McpTool[]> {
  const { Client, StreamableHTTPClientTransport, ListToolsResultSchema } =
    await loadMcpSdk()
  const client = new Client(MCP_CLIENT_INFO)
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl))

  try {
    await client.connect(transport)
    return await listTools(client, ListToolsResultSchema)
  } finally {
    await client.close()
  }
}
