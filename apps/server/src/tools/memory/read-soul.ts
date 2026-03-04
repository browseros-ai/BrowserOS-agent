import { tool } from 'ai'
import { z } from 'zod'
import { readSoul } from '../../lib/soul'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'soul_read'

export function createSoulReadTool() {
  return tool({
    description:
      'Read your current SOUL.md file — your personality, tone, and behavioral rules. Use this before calling soul_update to see what you already have.',
    inputSchema: z.object({}),
    execute: () =>
      executeWithMetrics(TOOL_NAME, async () => {
        const content = await readSoul()
        if (!content) {
          return { text: 'SOUL.md is empty or does not exist yet.' }
        }
        return { text: content }
      }),
    toModelOutput,
  })
}
