import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import { logger } from '../lib/logger'
import type { SkillFrontmatter, SkillMeta } from './types'

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath)
    return s.isDirectory()
  } catch {
    return false
  }
}

export function isValidFrontmatter(data: unknown): data is SkillFrontmatter {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.name === 'string' &&
    d.name.length > 0 &&
    typeof d.description === 'string' &&
    d.description.length > 0
  )
}

async function parseSkillFile(
  skillMdPath: string,
  dirName: string,
): Promise<SkillMeta | null> {
  try {
    const content = await readFile(skillMdPath, 'utf-8')
    const { data } = matter(content)

    if (!isValidFrontmatter(data)) {
      logger.warn('Skill missing required frontmatter fields', {
        path: skillMdPath,
        dirName,
      })
      return null
    }

    const meta = data.metadata
    return {
      id: dirName,
      name: meta?.['display-name'] || data.name,
      description: data.description,
      location: skillMdPath,
      enabled: meta?.enabled !== 'false',
      version: meta?.version,
    }
  } catch (err) {
    logger.warn('Failed to parse skill', {
      path: skillMdPath,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

async function scanSkills(skillsDir: string): Promise<SkillMeta[]> {
  let entries: string[]
  try {
    entries = await readdir(skillsDir)
  } catch {
    return []
  }

  const skills: SkillMeta[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const entryPath = join(skillsDir, entry)
    if (!(await isDirectory(entryPath))) continue

    const skillMdPath = join(entryPath, 'SKILL.md')
    try {
      await stat(skillMdPath)
    } catch {
      continue
    }

    const skill = await parseSkillFile(skillMdPath, entry)
    if (!skill || seen.has(skill.name)) continue

    seen.add(skill.name)
    skills.push(skill)
  }

  return skills
}

export async function loadSkills(skillsDir: string): Promise<SkillMeta[]> {
  const all = await scanSkills(skillsDir)
  return all.filter((s) => s.enabled)
}

export async function loadAllSkills(skillsDir: string): Promise<SkillMeta[]> {
  return scanSkills(skillsDir)
}
