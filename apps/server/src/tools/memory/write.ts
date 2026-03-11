import { tool } from 'ai'
import { z } from 'zod'
import { appendDailyMemory } from '../../lib/memory'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_write'

export function createMemoryWriteTool() {
  return tool({
    description:
      "Save a memory entry to long-term storage. Appends to today's memory file with a timestamp. Use for important information worth remembering across sessions.",
    inputSchema: z.object({
      content: z.string().describe('The memory content to save'),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        const fileName = await appendDailyMemory(params.content)
        return { text: `Memory saved to ${fileName}` }
      }),
    toModelOutput,
  })
}
