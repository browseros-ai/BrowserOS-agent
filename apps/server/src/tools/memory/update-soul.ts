import { tool } from 'ai'
import { z } from 'zod'
import { writeSoul } from '../../lib/soul'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'soul_update'

export function createSoulUpdateTool() {
  return tool({
    description:
      'Update your SOUL.md — your personality, tone, boundaries, and identity. Use this to evolve who you are based on conversations with the user. Overwrites the entire file, so include all content you want to keep.',
    inputSchema: z.object({
      content: z
        .string()
        .describe(
          'The full SOUL.md content. Will be truncated if it exceeds the max line limit.',
        ),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        await writeSoul(params.content)
        return { text: 'SOUL.md updated.' }
      }),
    toModelOutput,
  })
}
