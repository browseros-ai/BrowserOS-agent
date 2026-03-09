import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import matter from 'gray-matter'
import { getSkillsDir } from '../lib/browseros-dir'
import { logger } from '../lib/logger'
import { loadAllSkills } from './loader'
import type {
  CreateSkillInput,
  SkillDetail,
  SkillMeta,
  UpdateSkillInput,
} from './types'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Prevents path traversal — ensures resolved path stays inside skills directory
function safeSkillDir(id: string): string {
  const skillsDir = getSkillsDir()
  const resolved = resolve(skillsDir, id)
  if (!resolved.startsWith(`${skillsDir}/`)) {
    throw new Error('Invalid skill id')
  }
  return resolved
}

function buildSkillMd(
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  return matter.stringify(content, frontmatter)
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export async function listSkills(): Promise<SkillMeta[]> {
  return loadAllSkills(getSkillsDir())
}

export async function getSkill(id: string): Promise<SkillDetail | null> {
  const skillMdPath = join(safeSkillDir(id), 'SKILL.md')
  if (!(await fileExists(skillMdPath))) return null

  try {
    const raw = await readFile(skillMdPath, 'utf-8')
    const { data, content } = matter(raw)

    return {
      id,
      name: (data.name as string) || id,
      description: (data.description as string) || '',
      location: skillMdPath,
      enabled: data.enabled !== false,
      version: typeof data.version === 'string' ? data.version : undefined,
      content: content.trim(),
    }
  } catch (err) {
    logger.warn('Failed to read skill', {
      id,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export async function createSkill(input: CreateSkillInput): Promise<SkillMeta> {
  const id = slugify(input.name)
  if (!id) throw new Error('Invalid skill name')

  const dirPath = safeSkillDir(id)
  if (await fileExists(join(dirPath, 'SKILL.md'))) {
    throw new Error(`Skill "${id}" already exists`)
  }

  await mkdir(dirPath, { recursive: true })
  const frontmatter = {
    name: input.name,
    description: input.description,
    enabled: true,
  }
  await writeFile(
    join(dirPath, 'SKILL.md'),
    buildSkillMd(frontmatter, input.content),
  )

  return {
    id,
    name: input.name,
    description: input.description,
    location: join(dirPath, 'SKILL.md'),
    enabled: true,
  }
}

export async function updateSkill(
  id: string,
  input: UpdateSkillInput,
): Promise<SkillMeta> {
  const existing = await getSkill(id)
  if (!existing) throw new Error(`Skill "${id}" not found`)

  const name = input.name ?? existing.name
  const description = input.description ?? existing.description
  const content = input.content ?? existing.content
  const enabled = input.enabled ?? existing.enabled

  const frontmatter: Record<string, unknown> = {
    name,
    description,
    enabled,
  }
  if (existing.version) frontmatter.version = existing.version

  await writeFile(
    join(safeSkillDir(id), 'SKILL.md'),
    buildSkillMd(frontmatter, content),
  )

  return {
    id,
    name,
    description,
    location: existing.location,
    enabled,
    version: existing.version,
  }
}

export async function deleteSkill(id: string): Promise<void> {
  const dirPath = safeSkillDir(id)
  if (!(await fileExists(join(dirPath, 'SKILL.md')))) {
    throw new Error(`Skill "${id}" not found`)
  }
  await rm(dirPath, { recursive: true })
}
