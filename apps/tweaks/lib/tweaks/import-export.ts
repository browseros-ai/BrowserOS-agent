import { normalizeDomain } from './match'
import type { TweakRecord, TweakSource } from './types'

type ImportedTweakInput = Omit<TweakRecord, 'id' | 'createdAt' | 'updatedAt'>

type ExportShape = {
  version: 1
  tweak: TweakRecord
}

function buildImportedTweak(
  input: ImportedTweakInput,
  source: TweakSource,
): TweakRecord {
  const now = new Date().toISOString()
  return {
    ...input,
    id: crypto.randomUUID(),
    source,
    createdAt: now,
    updatedAt: now,
  }
}

export function exportTweak(tweak: TweakRecord): string {
  return JSON.stringify(
    {
      version: 1,
      tweak,
    } satisfies ExportShape,
    null,
    2,
  )
}

function parseExportShape(text: string): TweakRecord | null {
  try {
    const parsed = JSON.parse(text) as ExportShape | TweakRecord

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      parsed.version === 1 &&
      'tweak' in parsed
    ) {
      return parsed.tweak
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'name' in parsed &&
      'domains' in parsed &&
      'code' in parsed
    ) {
      return parsed as TweakRecord
    }
  } catch {
    return null
  }

  return null
}

function parseUserscriptMetadata(text: string): {
  name: string
  description: string
  domains: string[]
} {
  const name =
    text.match(/^\s*\/\/\s*@name\s+(.+)$/m)?.[1]?.trim() ??
    'Imported userscript'
  const description =
    text.match(/^\s*\/\/\s*@description\s+(.+)$/m)?.[1]?.trim() ??
    'Imported from userscript text.'

  const matches = [...text.matchAll(/^\s*\/\/\s*@match\s+(.+)$/gm)]
    .map((match) => match[1]?.trim() ?? '')
    .map((value) => {
      const normalized = value.replace(/^[a-z*]+:\/\//, '').replace(/\/.*$/, '')
      return normalizeDomain(normalized)
    })
    .filter((value): value is string => Boolean(value))

  return { name, description, domains: [...new Set(matches)] }
}

export function importTweak(text: string): TweakRecord {
  const parsedExport = parseExportShape(text)
  if (parsedExport) {
    return buildImportedTweak(
      {
        ...parsedExport,
        enabled: parsedExport.enabled,
      },
      parsedExport.source ?? 'imported',
    )
  }

  const metadata = parseUserscriptMetadata(text)
  const code = text.trim()

  if (!code) {
    throw new Error('Import text is empty.')
  }

  return buildImportedTweak(
    {
      name: metadata.name,
      description: metadata.description,
      enabled: false,
      source: 'imported',
      domains: metadata.domains,
      kind: 'javascript',
      code,
    },
    'imported',
  )
}
