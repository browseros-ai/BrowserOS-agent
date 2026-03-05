/** @public */
export interface McpTool {
  name: string
  description?: string
}

interface InitializeResult {
  protocolVersion?: string
}

interface ListToolsResult {
  nextCursor?: unknown
  tools?: Array<{
    description?: unknown
    name?: unknown
  }>
}

const JSON_RPC_VERSION = '2.0'
const MCP_PROTOCOL_VERSION = '2025-03-26'
const MCP_REQUEST_TIMEOUT_MS = 5_000
const MCP_CLIENT_INFO = {
  name: 'browseros-settings',
  version: '1.0.0',
}

function createMcpHeaders(
  sessionId?: string,
  protocolVersion?: string,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  }

  if (sessionId) {
    headers['mcp-session-id'] = sessionId
  }

  if (protocolVersion) {
    headers['mcp-protocol-version'] = protocolVersion
  }

  return headers
}

async function postMcpMessage(
  serverUrl: string,
  message: Record<string, unknown>,
  sessionId?: string,
  protocolVersion?: string,
): Promise<Response> {
  return fetch(serverUrl, {
    method: 'POST',
    headers: createMcpHeaders(sessionId, protocolVersion),
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(MCP_REQUEST_TIMEOUT_MS),
  })
}

function parseSseMessage(responseText: string): unknown {
  for (const block of responseText.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .join('\n')

    if (data) {
      return JSON.parse(data)
    }
  }

  throw new Error('MCP server returned an empty SSE response')
}

async function parseMcpMessage(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  if (contentType.includes('text/event-stream')) {
    return parseSseMessage(await response.text())
  }

  await response.body?.cancel()
  throw new Error(
    `Unsupported MCP response content type: ${contentType || 'unknown'}`,
  )
}

async function readMcpResult<TResult>(response: Response): Promise<TResult> {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      message || `MCP request failed with status ${response.status}`,
    )
  }

  const payload = await parseMcpMessage(response)
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid MCP response payload')
  }

  if (
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object'
  ) {
    const error = payload.error as { message?: unknown }
    throw new Error(
      typeof error.message === 'string' ? error.message : 'MCP request failed',
    )
  }

  if (!('result' in payload)) {
    throw new Error('MCP response missing result')
  }

  return payload.result as TResult
}

function normalizeTools(result: ListToolsResult): McpTool[] {
  if (!Array.isArray(result.tools)) {
    throw new Error('MCP tools response missing tools array')
  }

  return result.tools.map((tool) => {
    if (typeof tool.name !== 'string') {
      throw new Error('MCP tools response contains an invalid tool entry')
    }

    return {
      name: tool.name,
      description:
        typeof tool.description === 'string' ? tool.description : undefined,
    }
  })
}

function readNextCursor(result: ListToolsResult): string | undefined {
  if (typeof result.nextCursor === 'undefined') {
    return undefined
  }

  if (typeof result.nextCursor !== 'string') {
    throw new Error('MCP tools response contains an invalid cursor')
  }

  return result.nextCursor
}

/**
 * Fetches available tools from an MCP server
 * @public
 */
export async function fetchMcpTools(serverUrl: string): Promise<McpTool[]> {
  const initializeResponse = await postMcpMessage(serverUrl, {
    jsonrpc: JSON_RPC_VERSION,
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: MCP_CLIENT_INFO,
    },
  })
  const sessionId =
    initializeResponse.headers.get('mcp-session-id') ?? undefined
  const initializeResult =
    await readMcpResult<InitializeResult>(initializeResponse)
  const protocolVersion =
    typeof initializeResult.protocolVersion === 'string'
      ? initializeResult.protocolVersion
      : MCP_PROTOCOL_VERSION

  const initializedResponse = await postMcpMessage(
    serverUrl,
    {
      jsonrpc: JSON_RPC_VERSION,
      method: 'notifications/initialized',
    },
    sessionId,
    protocolVersion,
  )

  if (!initializedResponse.ok) {
    const message = await initializedResponse.text()
    throw new Error(
      message ||
        `MCP initialized notification failed with status ${initializedResponse.status}`,
    )
  }

  await initializedResponse.body?.cancel()

  const tools: McpTool[] = []
  let cursor: string | undefined
  let requestId = 1

  do {
    const toolsResponse = await postMcpMessage(
      serverUrl,
      {
        jsonrpc: JSON_RPC_VERSION,
        id: requestId,
        method: 'tools/list',
        ...(cursor ? { params: { cursor } } : {}),
      },
      sessionId,
      protocolVersion,
    )
    const toolsResult = await readMcpResult<ListToolsResult>(toolsResponse)
    tools.push(...normalizeTools(toolsResult))
    cursor = readNextCursor(toolsResult)
    requestId += 1
  } while (cursor)

  return tools
}
