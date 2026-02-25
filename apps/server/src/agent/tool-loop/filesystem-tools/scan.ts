import { readdir } from 'node:fs/promises'
import path from 'node:path'

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
])

export interface WalkEntry {
  absolutePath: string
  isDirectory: boolean
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Operation aborted')
  }
}

export async function walkEntries(
  rootPath: string,
  signal?: AbortSignal,
): Promise<WalkEntry[]> {
  const queue: string[] = [rootPath]
  const entries: WalkEntry[] = []

  while (queue.length > 0) {
    assertNotAborted(signal)

    const currentDir = queue.shift()
    if (!currentDir) continue

    const directoryEntries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of directoryEntries) {
      assertNotAborted(signal)

      const absolutePath = path.join(currentDir, entry.name)
      const isDirectory = entry.isDirectory()

      entries.push({ absolutePath, isDirectory })

      if (isDirectory && !IGNORED_DIRECTORIES.has(entry.name)) {
        queue.push(absolutePath)
      }
    }
  }

  return entries
}
