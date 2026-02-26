import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider'
import { type ToolSet, tool } from 'ai'
import type { ZodTypeAny } from 'zod'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import { bashTool } from './bash'
import { editTool } from './edit'
import { findTool } from './find'
import { grepTool } from './grep'
import { lsTool } from './ls'
import { readTool } from './read'
import type { FilesystemContentItem, FilesystemToolResult } from './types'
import { writeTool } from './write'

function contentToModelOutput(
  content: FilesystemContentItem[],
): LanguageModelV2ToolResultOutput {
  const hasImages = content.some((item) => item.type === 'image')

  if (!hasImages) {
    const text = content
      .filter(
        (item): item is Extract<FilesystemContentItem, { type: 'text' }> =>
          item.type === 'text',
      )
      .map((item) => item.text)
      .join('\n')

    return { type: 'text', value: text || 'Success' }
  }

  return {
    type: 'content',
    value: content.map((item) => {
      if (item.type === 'text') {
        return { type: 'text' as const, text: item.text }
      }

      return {
        type: 'media' as const,
        data: item.data,
        mediaType: item.mimeType,
      }
    }),
  }
}

const nativeTools = [
  readTool,
  bashTool,
  editTool,
  writeTool,
  grepTool,
  findTool,
  lsTool,
] as const

type NativeToolDefinition = {
  name: string
  description: string
  inputSchema: ZodTypeAny
  // biome-ignore lint/suspicious/noExplicitAny: tool schemas differ per tool and are normalized through runtime parse()
  execute: (input: any, cwd: string) => Promise<FilesystemToolResult>
}

const nativeToolDefinitions = nativeTools as unknown as NativeToolDefinition[]

export function buildFilesystemToolSet(cwd: string): ToolSet {
  const toolSet: ToolSet = {}

  for (const filesystemTool of nativeToolDefinitions) {
    const prefixedName = `filesystem_${filesystemTool.name}`

    toolSet[prefixedName] = tool({
      description: filesystemTool.description,
      inputSchema: filesystemTool.inputSchema,
      execute: async (params: unknown) => {
        const startTime = performance.now()

        try {
          const parsedParams = filesystemTool.inputSchema.parse(params)
          const result = await filesystemTool.execute(parsedParams, cwd)

          metrics.log('tool_executed', {
            tool_name: prefixedName,
            duration_ms: Math.round(performance.now() - startTime),
            success: !(result.isError ?? false),
          })

          return {
            content: result.content,
            isError: result.isError ?? false,
          }
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
            error_message: errorText,
          })

          return {
            content: [{ type: 'text' as const, text: errorText }],
            isError: true,
          }
        }
      },
      toModelOutput: ({ output }) => {
        const result = output as FilesystemToolResult

        if (result.isError) {
          const text = result.content
            .filter(
              (
                item,
              ): item is Extract<FilesystemContentItem, { type: 'text' }> =>
                item.type === 'text',
            )
            .map((item) => item.text)
            .join('\n')

          return { type: 'error-text', value: text }
        }

        if (!result.content || result.content.length === 0) {
          return { type: 'text', value: 'Success' }
        }

        return contentToModelOutput(result.content)
      },
    })
  }

  return toolSet
}
