import { tool } from 'ai'
import { z } from 'zod'
import { getCoreMemoryPath } from '../../lib/browseros-dir'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_save_core'

export function createSaveCoreTool() {
  return tool({
    description:
      'Write or update core memories. Overwrites the entire core memory file. Use to promote frequently referenced or critical information from daily memories.',
    inputSchema: z.object({
      content: z.string().describe('The full core memory content to save'),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        await Bun.write(getCoreMemoryPath(), params.content)
        return { text: 'Core memories updated.' }
      }),
    toModelOutput,
  })
}
