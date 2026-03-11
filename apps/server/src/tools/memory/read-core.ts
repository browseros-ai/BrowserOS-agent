import { tool } from 'ai'
import { z } from 'zod'
import { readCoreMemory } from '../../lib/memory'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_read_core'

export function createReadCoreTool() {
  return tool({
    description:
      'Read the full contents of core memory (CORE.md). Always call this before memory_save_core to avoid overwriting existing entries.',
    inputSchema: z.object({}),
    execute: () =>
      executeWithMetrics(TOOL_NAME, async () => {
        const content = await readCoreMemory()
        if (!content.trim()) {
          return { text: 'No core memories yet.' }
        }
        return { text: content }
      }),
    toModelOutput,
  })
}
