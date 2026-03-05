import { readFileSync } from 'node:fs'

import type { BuildTarget, ResourceManifest, ResourceRule } from './types'

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}

function validateRule(rule: ResourceRule): void {
  if (!rule.name || rule.name.trim().length === 0) {
    throw new Error('Manifest rule is missing name')
  }
  if (!rule.source || rule.source.type !== 'r2') {
    throw new Error(`Manifest rule ${rule.name} has unsupported source type`)
  }
  if (!rule.source.key || !rule.destination) {
    throw new Error(
      `Manifest rule ${rule.name} is missing source key or destination`,
    )
  }
}

function parseRule(raw: unknown): ResourceRule {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Manifest contains an invalid rule entry')
  }
  const item = raw as Record<string, unknown>
  const rule: ResourceRule = {
    name: String(item.name ?? ''),
    source: {
      type: 'r2',
      key: String(
        (item.source as Record<string, unknown> | undefined)?.key ?? '',
      ),
    },
    destination: String(item.destination ?? ''),
    executable: item.executable === true,
  }
  if (isStringArray(item.os)) {
    rule.os = item.os as ResourceRule['os']
  }
  if (isStringArray(item.arch)) {
    rule.arch = item.arch as ResourceRule['arch']
  }
  validateRule(rule)
  return rule
}

export function loadManifest(path: string): ResourceManifest {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  if (!Array.isArray(raw.resources)) {
    throw new Error(`Manifest is missing resources array: ${path}`)
  }
  return {
    resources: raw.resources.map((entry) => parseRule(entry)),
  }
}

export function getTargetRules(
  manifest: ResourceManifest,
  target: BuildTarget,
): ResourceRule[] {
  return manifest.resources.filter((rule) => {
    if (rule.os && !rule.os.includes(target.os)) {
      return false
    }
    if (rule.arch && !rule.arch.includes(target.arch)) {
      return false
    }
    return true
  })
}
