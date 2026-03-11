import { stat } from 'node:fs/promises'
import { getCoreMemoryPath } from './browseros-dir'

export interface CoreMemoryDocument {
  content: string
  exists: boolean
  updatedAt: string | null
}

async function getUpdatedAt(filePath: string): Promise<string | null> {
  try {
    const fileStat = await stat(filePath)
    return fileStat.mtime.toISOString()
  } catch {
    return null
  }
}

export async function readCoreMemory(): Promise<CoreMemoryDocument> {
  const filePath = getCoreMemoryPath()
  const file = Bun.file(filePath)

  if (!(await file.exists())) {
    return {
      content: '',
      exists: false,
      updatedAt: null,
    }
  }

  return {
    content: await file.text(),
    exists: true,
    updatedAt: await getUpdatedAt(filePath),
  }
}

export async function saveCoreMemory(
  content: string,
): Promise<CoreMemoryDocument> {
  const filePath = getCoreMemoryPath()

  await Bun.write(filePath, content)

  return {
    content,
    exists: true,
    updatedAt: await getUpdatedAt(filePath),
  }
}
