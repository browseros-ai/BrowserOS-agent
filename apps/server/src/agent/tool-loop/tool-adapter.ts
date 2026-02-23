import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider'
import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js'
import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import type { ControllerBridge } from '../../browser/extension/bridge'
import { ScopedControllerContext } from '../../browser/extension/context'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import type { MutexPool } from '../../lib/mutex'
import { ControllerResponse } from '../../tools/controller-based/response/controller-response'
import type { ToolDefinition } from '../../tools/types/tool-definition'

type McpContent = Array<TextContent | ImageContent>

function mcpContentToModelOutput(
  content: McpContent,
): LanguageModelV2ToolResultOutput {
  const hasImages = content.some((c) => c.type === 'image')

  if (!hasImages) {
    const text = content
      .filter((c): c is TextContent => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
    return { type: 'text', value: text || 'Success' }
  }

  const parts: LanguageModelV2ToolResultOutput & { type: 'content' } = {
    type: 'content',
    value: content.map((c) => {
      if (c.type === 'text') {
        return { type: 'text' as const, text: c.text }
      }
      return {
        type: 'media' as const,
        data: c.data,
        mediaType: c.mimeType,
      }
    }),
  }

  return parts
}

export function buildControllerToolSet(
  tools: ToolDefinition[],
  bridge: ControllerBridge,
  windowId?: number,
  mutexPool?: MutexPool,
): ToolSet {
  const toolSet: ToolSet = {}

  for (const def of tools) {
    toolSet[`browser_${def.name}`] = tool({
      description: def.description,
      inputSchema: z.object(def.schema),
      execute: async (params) => {
        const startTime = performance.now()
        const mutex = mutexPool?.getMutex(windowId)
        const guard = mutex ? await mutex.acquire() : undefined
        try {
          const context = new ScopedControllerContext(bridge, windowId)
          const response = new ControllerResponse()
          await def.handler({ params }, response, context)
          const content = await response.handle(context)

          metrics.log('tool_executed', {
            tool_name: def.name,
            duration_ms: Math.round(performance.now() - startTime),
            success: true,
          })

          return { content, isError: false }
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : String(error)

          logger.error('Controller tool execution failed', {
            tool: def.name,
            error: errorText,
          })
          metrics.log('tool_executed', {
            tool_name: def.name,
            duration_ms: Math.round(performance.now() - startTime),
            success: false,
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
          })

          return {
            content: [{ type: 'text' as const, text: errorText }],
            isError: true,
          }
        } finally {
          guard?.dispose()
        }
      },
      toModelOutput: (output) => {
        const result = output as unknown as {
          content: McpContent
          isError: boolean
        }
        if (result.isError) {
          const text = result.content
            .filter((c): c is TextContent => c.type === 'text')
            .map((c) => c.text)
            .join('\n')
          return { type: 'error-text', value: text }
        }
        if (!result.content?.length) {
          return { type: 'text', value: 'Success' }
        }
        return mcpContentToModelOutput(result.content)
      },
    })
  }

  return toolSet
}
