import { tool } from 'ai'
import { z } from 'zod'
import { getCoreMemoryPath } from '../../lib/browseros-dir'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_read_core'

export function createReadCoreTool() {
  return tool({
    description:
      'Read the full contents of core memory (CORE.md). Always call this before memory_save_core to avoid overwriting existing entries.',
    inputSchema: z.object({}),
    execute: () =>
      executeWithMetrics(TOOL_NAME, async () => {
        const file = Bun.file(getCoreMemoryPath())
        if (!(await file.exists())) {
          return { text: 'No core memories yet.' }
        }
        const content = await file.text()
        if (!content.trim()) {
          return { text: 'Core memory file is empty.' }
        }
        return { text: content }
      }),
    toModelOutput,
  })
}
