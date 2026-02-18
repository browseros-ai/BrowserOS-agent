/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Internal MCP client for SDK routes.
 * Provides typed access to MCP tool results with structured content.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export interface McpContent {
  type: 'text' | 'image'
  text?: string
  data?: string
  mimeType?: string
}

export interface McpToolResult<T = Record<string, unknown>> {
  content: McpContent[]
  structuredContent?: T
  isError?: boolean
}

interface McpClientOptions {
  headers?: Record<string, string>
  source?: string
}

export interface McpToolDescriptor {
  name: string
  description?: string
  inputSchema: {
    [x: string]: unknown
    type: 'object'
    properties?: Record<string, object>
    required?: string[]
  }
}

function createTransport(
  serverUrl: string,
  options?: McpClientOptions,
): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        'X-BrowserOS-Source': options?.source ?? 'sdk-internal',
        ...(options?.headers ?? {}),
      },
    },
  })
}

export async function callMcpTool<T = Record<string, unknown>>(
  serverUrl: string,
  name: string,
  args: Record<string, unknown> = {},
  options?: McpClientOptions,
): Promise<McpToolResult<T>> {
  const client = new Client({
    name: 'browseros-sdk-internal',
    version: '1.0.0',
  })

  const transport = createTransport(serverUrl, options)

  try {
    await client.connect(transport)
    return (await client.callTool({
      name,
      arguments: args,
    })) as McpToolResult<T>
  } finally {
    await transport.close()
  }
}

export async function listMcpTools(
  serverUrl: string,
  options?: McpClientOptions,
): Promise<McpToolDescriptor[]> {
  const client = new Client({
    name: 'browseros-sdk-internal',
    version: '1.0.0',
  })
  const transport = createTransport(serverUrl, options)

  try {
    await client.connect(transport)
    const result = await client.listTools()
    return result.tools as McpToolDescriptor[]
  } finally {
    await transport.close()
  }
}

export function getTextContent<T>(result: McpToolResult<T>): string {
  const textItem = result.content.find((c) => c.type === 'text')
  return textItem?.text ?? ''
}

export function getImageContent<T>(
  result: McpToolResult<T>,
): { data: string; mimeType: string } | undefined {
  const imageItem = result.content.find((c) => c.type === 'image')
  if (!imageItem?.data || !imageItem?.mimeType) return undefined
  return { data: imageItem.data, mimeType: imageItem.mimeType }
}
