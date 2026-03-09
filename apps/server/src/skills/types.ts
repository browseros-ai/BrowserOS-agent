export type SkillMeta = {
  id: string
  name: string
  description: string
  location: string
  enabled: boolean
  version?: string
}

export type SkillDetail = SkillMeta & {
  content: string
}

export type CreateSkillInput = {
  name: string
  description: string
  content: string
}

export type UpdateSkillInput = Partial<CreateSkillInput> & {
  enabled?: boolean
}
