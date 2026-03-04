import { appendFile, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { PATHS } from '@browseros/shared/constants/paths'
import { tool } from 'ai'
import { z } from 'zod'
import { getMemoryDir } from '../../lib/browseros-dir'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_write'

function getTodayFileName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}.md`
}

function getCurrentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

async function cleanOldMemories(memoryDir: string): Promise<void> {
  let files: string[]
  try {
    files = await readdir(memoryDir)
  } catch {
    return
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PATHS.MEMORY_RETENTION_DAYS)
  const year = cutoff.getFullYear()
  const month = String(cutoff.getMonth() + 1).padStart(2, '0')
  const day = String(cutoff.getDate()).padStart(2, '0')
  const cutoffStr = `${year}-${month}-${day}`

  for (const file of files) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
    if (match && match[1] < cutoffStr) {
      try {
        await unlink(join(memoryDir, file))
      } catch {
        // skip if already removed
      }
    }
  }
}

export function createMemoryWriteTool() {
  return tool({
    description:
      "Save a memory entry to long-term storage. Appends to today's memory file with a timestamp. Use for important information worth remembering across sessions.",
    inputSchema: z.object({
      content: z.string().describe('The memory content to save'),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        const memoryDir = getMemoryDir()
        const filePath = join(memoryDir, getTodayFileName())
        const entry = `\n## ${getCurrentTime()}\n\n${params.content}\n`

        await appendFile(filePath, entry, 'utf-8')

        await cleanOldMemories(memoryDir)

        return { text: `Memory saved to ${getTodayFileName()}` }
      }),
    toModelOutput,
  })
}
