import { tool } from 'ai'
import { z } from 'zod'
import { getCoreMemoryPath } from '../../lib/browseros-dir'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_read_core'

export function createReadCoreTool() {
  return tool({
    description:
      'Read core memories — the most important, long-term facts promoted from daily memories. These persist indefinitely.',
    inputSchema: z.object({}),
    execute: () =>
      executeWithMetrics(TOOL_NAME, async () => {
        const file = Bun.file(getCoreMemoryPath())
        if (!(await file.exists())) {
          return { text: 'No core memories found.' }
        }
        const content = await file.text()
        return { text: content || 'No core memories found.' }
      }),
    toModelOutput,
  })
}
