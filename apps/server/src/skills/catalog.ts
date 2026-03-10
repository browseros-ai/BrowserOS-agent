import type { SkillMeta } from './types'

const SKILL_BEHAVIORAL_INSTRUCTION = `The following skills provide specialized instructions for specific tasks.
When a task matches a skill's description, use filesystem_read to load the SKILL.md at the listed location before proceeding.
When a skill references relative paths (e.g., scripts/), resolve them against the skill's directory (the parent of SKILL.md) and use absolute paths in tool calls.`

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildSkillsCatalog(skills: SkillMeta[]): string {
  if (skills.length === 0) return ''

  const skillEntries = skills
    .map(
      (s) =>
        `<skill>
<name>${escapeXml(s.name)}</name>
<description>${escapeXml(s.description)}</description>
<location>${escapeXml(s.location)}</location>
</skill>`,
    )
    .join('\n')

  return `${SKILL_BEHAVIORAL_INSTRUCTION}

<available_skills>
${skillEntries}
</available_skills>`
}
