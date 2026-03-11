import { tool } from 'ai'
import { z } from 'zod'
import { saveCoreMemory } from '../../lib/core-memory'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_save_core'

export function createSaveCoreTool() {
  return tool({
    description:
      'Write or update core memories. IMPORTANT: This overwrites the entire core memory file. Always call memory_read_core first, merge your changes into the existing content, then save the full result.',
    inputSchema: z.object({
      content: z.string().describe('The full core memory content to save'),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        await saveCoreMemory(params.content)
        return { text: 'Core memories updated.' }
      }),
    toModelOutput,
  })
}
