import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tool } from 'ai'
import Fuse from 'fuse.js'
import { z } from 'zod'
import { getMemoryDir } from '../../lib/browseros-dir'
import { executeWithMetrics, toModelOutput } from '../filesystem/utils'

const TOOL_NAME = 'memory_search'

interface MemoryEntry {
  source: string
  content: string
}

async function loadMemoryEntries(): Promise<MemoryEntry[]> {
  const memoryDir = getMemoryDir()
  let files: string[]
  try {
    files = await readdir(memoryDir)
  } catch {
    return []
  }

  const mdFiles = files.filter((f) => f.endsWith('.md') && f !== 'CORE.md')

  const entries: MemoryEntry[] = []
  for (const file of mdFiles) {
    try {
      const content = await readFile(join(memoryDir, file), 'utf-8')
      const sections = content.split(/^## /m).filter(Boolean)
      for (const section of sections) {
        entries.push({ source: file, content: `## ${section}`.trim() })
      }
    } catch {
      // skip unreadable files
    }
  }
  return entries
}

export function createMemorySearchTool() {
  return tool({
    description:
      'Search through long-term memory entries using fuzzy matching. Returns relevant past memories with their source dates.',
    inputSchema: z.object({
      query: z.string().describe('Search query to find relevant memories'),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        const entries = await loadMemoryEntries()
        if (entries.length === 0) {
          return { text: 'No memories found.' }
        }

        const fuse = new Fuse(entries, {
          keys: ['content'],
          threshold: 0.4,
          includeScore: true,
        })

        const results = fuse.search(params.query, { limit: 10 })
        if (results.length === 0) {
          return { text: `No memories matching "${params.query}" found.` }
        }

        const formatted = results
          .map((r) => {
            const score = r.score !== undefined ? (1 - r.score).toFixed(2) : '?'
            return `[${r.item.source}] (relevance: ${score})\n${r.item.content}`
          })
          .join('\n\n---\n\n')

        return { text: formatted }
      }),
    toModelOutput,
  })
}
