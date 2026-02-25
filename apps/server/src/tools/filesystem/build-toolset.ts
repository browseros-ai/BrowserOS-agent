import { type ToolSet, tool } from 'ai'
import type { z } from 'zod'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import type { ContentItem, ToolResult } from '../response'
import { bash } from './bash'
import { edit } from './edit'
import { find } from './find'
import { grep } from './grep'
import { ls } from './ls'
import { read } from './read'
import { write } from './write'

export interface FilesystemToolDef {
  name: string
  description: string
  input: z.ZodType
  // biome-ignore lint/suspicious/noExplicitAny: tool params vary per tool
  execute(args: any, cwd: string): Promise<ToolResult>
}

const ALL_TOOLS: FilesystemToolDef[] = [read, bash, edit, write, grep, find, ls]

function contentToModelOutput(content: ContentItem[]) {
  const hasImages = content.some((c) => c.type === 'image')

  if (!hasImages) {
    const text = content
      .filter((c): c is ContentItem & { type: 'text' } => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
    return { type: 'text' as const, value: text || 'Success' }
  }

  return {
    type: 'content' as const,
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

export function buildFilesystemToolSet(cwd: string): ToolSet {
  const toolSet: ToolSet = {}

  for (const def of ALL_TOOLS) {
    const prefixedName = `filesystem_${def.name}`

    toolSet[prefixedName] = tool({
      description: def.description,
      inputSchema: def.input,
      execute: async (params) => {
        const startTime = performance.now()
        try {
          const result = await def.execute(params, cwd)

          metrics.log('tool_executed', {
            tool_name: prefixedName,
            duration_ms: Math.round(performance.now() - startTime),
            success: !result.isError,
          })

          return { content: result.content, isError: result.isError ?? false }
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
          content: ContentItem[]
          isError: boolean
        }
        if (result.isError) {
          const text = result.content
            .filter(
              (c): c is ContentItem & { type: 'text' } => c.type === 'text',
            )
            .map((c) => c.text)
            .join('\n')
          return { type: 'error-text', value: text }
        }
        if (!result.content?.length) {
          return { type: 'text', value: 'Success' }
        }
        return contentToModelOutput(result.content)
      },
    })
  }

  return toolSet
}
