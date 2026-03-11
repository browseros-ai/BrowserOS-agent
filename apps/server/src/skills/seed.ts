import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSkillsDir } from '../lib/browseros-dir'
import { logger } from '../lib/logger'
import { DEFAULT_SKILLS } from './defaults'

async function hasExistingSkills(skillsDir: string): Promise<boolean> {
  try {
    const entries = await readdir(skillsDir)
    return entries.some((e) => !e.startsWith('.'))
  } catch {
    return false
  }
}

export async function seedDefaultSkills(): Promise<void> {
  const skillsDir = getSkillsDir()
  if (await hasExistingSkills(skillsDir)) return

  let seeded = 0
  for (const skill of DEFAULT_SKILLS) {
    try {
      const targetDir = join(skillsDir, skill.id)
      await mkdir(targetDir, { recursive: true })
      await writeFile(join(targetDir, 'SKILL.md'), skill.content)
      seeded++
    } catch (err) {
      logger.warn('Failed to seed skill', {
        id: skill.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (seeded > 0) {
    logger.info(`Seeded ${seeded} default skills`)
  }
}
