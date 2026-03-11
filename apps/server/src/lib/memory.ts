import { appendFile, readdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { PATHS } from '@browseros/shared/constants/paths'
import {
  ensureBrowserosDir,
  getCoreMemoryPath,
  getMemoryDir,
} from './browseros-dir'

const DAILY_MEMORY_FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.md$/

export interface DailyMemoryFile {
  fileName: string
  date: string
  content: string
}

export interface MemorySnapshot {
  coreMemory: string
  dailyMemories: DailyMemoryFile[]
  retentionDays: number
}

function formatDateParts(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayMemoryFileName(date = new Date()): string {
  return `${formatDateParts(date)}.md`
}

export function getCurrentMemoryTimestamp(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

async function listMemoryFiles(): Promise<string[]> {
  try {
    return await readdir(getMemoryDir())
  } catch {
    return []
  }
}

export async function cleanOldDailyMemories(): Promise<void> {
  const files = await listMemoryFiles()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PATHS.MEMORY_RETENTION_DAYS)
  const cutoffDate = formatDateParts(cutoff)

  for (const file of files) {
    const match = file.match(DAILY_MEMORY_FILE_PATTERN)
    if (!match || match[1] >= cutoffDate) continue
    try {
      await unlink(join(getMemoryDir(), file))
    } catch {}
  }
}

export async function appendDailyMemory(content: string): Promise<string> {
  await ensureBrowserosDir()
  const fileName = getTodayMemoryFileName()
  const filePath = join(getMemoryDir(), fileName)
  const entry = `\n## ${getCurrentMemoryTimestamp()}\n\n${content}\n`

  await appendFile(filePath, entry, 'utf-8')
  await cleanOldDailyMemories()

  return fileName
}

export async function readCoreMemory(): Promise<string> {
  const file = Bun.file(getCoreMemoryPath())
  if (!(await file.exists())) return ''
  return file.text()
}

export async function saveCoreMemory(content: string): Promise<void> {
  await ensureBrowserosDir()
  await Bun.write(getCoreMemoryPath(), content)
}

export async function listDailyMemories(): Promise<DailyMemoryFile[]> {
  const files = await listMemoryFiles()
  const dailyFiles = files
    .map((fileName) => {
      const match = fileName.match(DAILY_MEMORY_FILE_PATTERN)
      if (!match) return null
      return { fileName, date: match[1] }
    })
    .filter(
      (entry): entry is { fileName: string; date: string } => entry !== null,
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const memories: DailyMemoryFile[] = []
  for (const dailyFile of dailyFiles) {
    try {
      const content = await readFile(
        join(getMemoryDir(), dailyFile.fileName),
        'utf-8',
      )
      memories.push({ ...dailyFile, content })
    } catch {}
  }

  return memories
}

export async function readMemorySnapshot(): Promise<MemorySnapshot> {
  const [coreMemory, dailyMemories] = await Promise.all([
    readCoreMemory(),
    listDailyMemories(),
  ])

  return {
    coreMemory,
    dailyMemories,
    retentionDays: PATHS.MEMORY_RETENTION_DAYS,
  }
}
