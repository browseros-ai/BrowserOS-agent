import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider'
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core'
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from '@mariozechner/pi-coding-agent'
import { jsonSchema, type ToolSet, tool } from 'ai'
import { logger } from '../../../lib/logger'
import { metrics } from '../../../lib/metrics'

type PiContent = AgentToolResult<unknown>['content']

function piContentToModelOutput(
  content: PiContent,
): LanguageModelV2ToolResultOutput {
  const hasImages = content.some((c) => c.type === 'image')

  if (!hasImages) {
    const text = content
      .filter(
        (c): c is PiContent[number] & { type: 'text' } => c.type === 'text',
      )
      .map((c) => c.text)
      .join('\n')
    return { type: 'text', value: text || 'Success' }
  }

  return {
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
}

// biome-ignore lint/suspicious/noExplicitAny: AgentTool is contravariant on TParameters — each createXxxTool returns a specific generic that can't assign to AgentTool<TSchema> without widening
function createAllTools(cwd: string): Record<string, AgentTool<any>> {
  return {
    read: createReadTool(cwd),
    bash: createBashTool(cwd),
    edit: createEditTool(cwd),
    write: createWriteTool(cwd),
    grep: createGrepTool(cwd),
    find: createFindTool(cwd),
    ls: createLsTool(cwd),
  }
}

export function buildFilesystemToolSet(cwd: string): ToolSet {
  const piTools = createAllTools(cwd)
  const toolSet: ToolSet = {}

  for (const [name, piTool] of Object.entries(piTools)) {
    const prefixedName = `filesystem_${name}`

    toolSet[prefixedName] = tool({
      description: piTool.description,
      inputSchema: jsonSchema(
        JSON.parse(JSON.stringify(piTool.parameters)) as Parameters<
          typeof jsonSchema
        >[0],
      ),
      execute: async (params) => {
        const startTime = performance.now()
        try {
          const result = await piTool.execute(crypto.randomUUID(), params)

          metrics.log('tool_executed', {
            tool_name: prefixedName,
            duration_ms: Math.round(performance.now() - startTime),
            success: true,
          })

          return { content: result.content, isError: false }
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : String(error)

          logger.error('Filesystem tool execution failed', {
            tool: prefixedName,
            error: errorText,
          })
          metrics.log('tool_executed', {
            tool_name: prefixedName,
            duration_ms: Math.round(performance.now() - startTime),
            success: false,
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
          })

          return {
            content: [{ type: 'text' as const, text: errorText }],
            isError: true,
          }
        }
      },
      toModelOutput: ({ output }) => {
        const result = output as {
          content: PiContent
          isError: boolean
        }
        if (result.isError) {
          const text = result.content
            .filter(
              (c): c is PiContent[number] & { type: 'text' } =>
                c.type === 'text',
            )
            .map((c) => c.text)
            .join('\n')
          return { type: 'error-text', value: text }
        }
        if (!result.content?.length) {
          return { type: 'text', value: 'Success' }
        }
        return piContentToModelOutput(result.content)
      },
    })
  }

  return toolSet
}
