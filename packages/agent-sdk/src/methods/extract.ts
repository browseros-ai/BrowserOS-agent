import { zodToJsonSchema } from 'zod-to-json-schema'
import type { AgentContext } from '../context'
import { ExtractionError } from '../errors'
import type { ExtractOptions, ExtractResult } from '../types'
import { request } from '../utils/request'

export async function extract<T>(
  ctx: AgentContext,
  instruction: string,
  options: ExtractOptions<T>,
): Promise<ExtractResult<T>> {
  ctx.emit({ type: 'start-step' })
  ctx.emit({ type: 'text-start', id: 'extract' })
  ctx.emit({
    type: 'text-delta',
    id: 'extract',
    delta: `Extracting: ${instruction}...\n`,
  })

  const jsonSchema = zodToJsonSchema(options.schema)

  const result = await request<ExtractResult<T>>(
    ctx,
    '/sdk/extract',
    {
      instruction,
      schema: jsonSchema,
      context: options.context,
      windowId: ctx.browserContext?.windowId,
    },
    ExtractionError,
  )

  ctx.emit({
    type: 'text-delta',
    id: 'extract',
    delta: 'Extraction complete.\n',
  })
  ctx.emit({ type: 'text-end', id: 'extract' })
  ctx.emit({ type: 'finish-step' })

  return result
}
