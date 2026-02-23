import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider'
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

type PiContent = Array<
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
>

interface PiTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<{ content: PiContent; details: unknown }>
}

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

function createAllTools(cwd: string): Record<string, PiTool> {
  return {
    read: createReadTool(cwd) as unknown as PiTool,
    bash: createBashTool(cwd) as unknown as PiTool,
    edit: createEditTool(cwd) as unknown as PiTool,
    write: createWriteTool(cwd) as unknown as PiTool,
    grep: createGrepTool(cwd) as unknown as PiTool,
    find: createFindTool(cwd) as unknown as PiTool,
    ls: createLsTool(cwd) as unknown as PiTool,
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
          const result = await piTool.execute(
            crypto.randomUUID(),
            params as Record<string, unknown>,
          )

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
