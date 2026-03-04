import { PATHS } from '@browseros/shared/constants/paths'
import { tool } from 'ai'
import { z } from 'zod'
import { writeSoul } from '../../lib/soul'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'soul_update'

export function createSoulUpdateTool() {
  return tool({
    description: `Update your SOUL.md — your personality, tone, boundaries, and identity. Use this to evolve who you are based on conversations with the user. Overwrites the entire file, so include all content you want to keep. Max ${PATHS.SOUL_MAX_LINES} lines.`,
    inputSchema: z.object({
      content: z
        .string()
        .describe(
          `The full SOUL.md content. Max ${PATHS.SOUL_MAX_LINES} lines — excess lines are dropped from the end.`,
        ),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        const result = await writeSoul(params.content)
        if (result.truncated) {
          return {
            text: `SOUL.md updated (${result.linesWritten}/${PATHS.SOUL_MAX_LINES} lines). ${result.linesDropped} low-priority lines were trimmed from the end:\n\n${result.droppedContent}\n\nThis is expected — keep SOUL.md concise. Only retry if something critical was lost.`,
          }
        }
        return { text: `SOUL.md updated (${result.linesWritten} lines).` }
      }),
    toModelOutput,
  })
}
