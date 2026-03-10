import {
  createSdkMcpServer,
  tool as sdkTool,
} from '@anthropic-ai/claude-agent-sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ToolSet } from 'ai'
import type { z } from 'zod'
import type { Browser } from '../browser/browser'
import { logger } from '../lib/logger'
import { metrics } from '../lib/metrics'
import { executeTool } from '../tools/framework'
import type { ContentItem } from '../tools/response'
import type { ToolRegistry } from '../tools/tool-registry'

function contentToCallToolResult(
  content: ContentItem[],
  isError?: boolean,
): CallToolResult {
  return {
    content: content.map((c) => {
      if (c.type === 'text') return { type: 'text' as const, text: c.text }
      return {
        type: 'image' as const,
        data: c.data,
        mimeType: c.mimeType,
      }
    }),
    isError,
  }
}

function extractShape(schema: z.ZodType): Record<string, z.ZodType> {
  if ('shape' in schema && typeof schema.shape === 'object') {
    return schema.shape as Record<string, z.ZodType>
  }
  // ZodEffects, ZodTransformed, etc. don't expose .shape — tool will have no parameters
  logger.warn(
    'Schema has no .shape property, tool will have empty parameters',
    {
      schemaType: schema.constructor?.name,
    },
  )
  return {}
}

export function createBrowserMcpServer(
  registry: ToolRegistry,
  browser: Browser,
) {
  const ctx = { browser }
  const tools = registry.all().map((def) => {
    const shape = extractShape(def.input)
    return sdkTool(
      def.name,
      def.description,
      shape,
      async (args: Record<string, unknown>) => {
        const startTime = performance.now()
        try {
          const result = await executeTool(
            def,
            args,
            ctx,
            AbortSignal.timeout(120_000),
          )
          metrics.log('tool_executed', {
            tool_name: def.name,
            duration_ms: Math.round(performance.now() - startTime),
            success: !result.isError,
          })
          return contentToCallToolResult(result.content, result.isError)
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : String(error)
          logger.error('Tool execution failed', {
            tool: def.name,
            error: errorText,
          })
          metrics.log('tool_executed', {
            tool_name: def.name,
            duration_ms: Math.round(performance.now() - startTime),
            success: false,
          })
          return { content: [{ type: 'text', text: errorText }], isError: true }
        }
      },
    )
  })

  return createSdkMcpServer({ name: 'browser-tools', version: '1.0.0', tools })
}

export function createToolSetMcpServer(toolSet: ToolSet, name: string) {
  const tools = Object.entries(toolSet).map(([toolName, def]) => {
    const shape = extractShape(def.inputSchema as z.ZodType)
    return sdkTool(
      toolName,
      def.description ?? toolName,
      shape,
      async (args: Record<string, unknown>) => {
        const startTime = performance.now()
        try {
          const raw = await def.execute?.(args, {
            toolCallId: crypto.randomUUID(),
            messages: [],
          })
          metrics.log('tool_executed', {
            tool_name: toolName,
            duration_ms: Math.round(performance.now() - startTime),
            success: true,
          })
          if (typeof raw === 'string') {
            return { content: [{ type: 'text', text: raw }] }
          }
          if (raw && typeof raw === 'object' && 'content' in raw) {
            const result = raw as {
              content: ContentItem[]
              isError?: boolean
            }
            return contentToCallToolResult(result.content, result.isError)
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(raw) ?? 'Success' }],
          }
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : String(error)
          logger.error('ToolSet tool execution failed', {
            tool: toolName,
            error: errorText,
          })
          metrics.log('tool_executed', {
            tool_name: toolName,
            duration_ms: Math.round(performance.now() - startTime),
            success: false,
          })
          return { content: [{ type: 'text', text: errorText }], isError: true }
        }
      },
    )
  })

  return createSdkMcpServer({ name, version: '1.0.0', tools })
}
