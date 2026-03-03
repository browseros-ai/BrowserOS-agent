import { PATHS } from '@browseros/shared/constants/paths'
import { getSoulPath } from './browseros-dir'

export async function readSoul(): Promise<string> {
  const file = Bun.file(getSoulPath())
  if (!(await file.exists())) return ''
  return file.text()
}

export async function writeSoul(content: string): Promise<void> {
  const lines = content.split('\n')
  const truncated = lines.slice(0, PATHS.SOUL_MAX_LINES).join('\n')
  await Bun.write(getSoulPath(), truncated)
}
