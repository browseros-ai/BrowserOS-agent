export type TweakKind = 'css' | 'javascript'
export type TweakSource = 'starter' | 'custom' | 'imported'
export type CapabilitySignal =
  | 'network'
  | 'clipboard'
  | 'notifications'
  | 'storage'

export type TweakRecord = {
  id: string
  name: string
  description: string
  enabled: boolean
  source: TweakSource
  domains: string[]
  kind: TweakKind
  code: string
  createdAt: string
  updatedAt: string
  starterId?: string
}

export type EditorDraft = Omit<TweakRecord, 'domains'> & {
  domainsText: string
}
