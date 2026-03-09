import { parseDomains } from './match'
import { STARTER_TWEAKS } from './starter-tweaks'
import type { EditorDraft, TweakKind, TweakRecord } from './types'

const TWEAKS_KEY = 'browseros.tweaks.records'

type StorageShape = {
  [TWEAKS_KEY]?: TweakRecord[]
}

function sortTweaks(tweaks: TweakRecord[]): TweakRecord[] {
  return [...tweaks].sort((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

export function createDraft(hostname?: string): EditorDraft {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: hostname ? `New tweak for ${hostname}` : 'Untitled tweak',
    description: '',
    enabled: false,
    source: 'custom',
    domainsText: hostname ?? '',
    kind: 'css',
    code: hostname
      ? `/* Tweaks Studio applies this tweak on ${hostname} and subdomains. */\n`
      : '/* Add CSS or switch to JavaScript. */\n',
    createdAt: now,
    updatedAt: now,
  }
}

export function draftToTweak(draft: EditorDraft): TweakRecord {
  const domains = parseDomains(draft.domainsText)

  if (!draft.name.trim()) {
    throw new Error('A tweak name is required.')
  }

  if (domains.length === 0) {
    throw new Error('Add at least one domain.')
  }

  if (!draft.code.trim()) {
    throw new Error('Add tweak code before saving.')
  }

  return {
    id: draft.id,
    name: draft.name.trim(),
    description: draft.description.trim(),
    enabled: draft.enabled,
    source: draft.source,
    domains,
    kind: draft.kind,
    code: draft.code,
    createdAt: draft.createdAt,
    updatedAt: new Date().toISOString(),
    starterId: draft.starterId,
  }
}

export function tweakToDraft(tweak: TweakRecord): EditorDraft {
  return {
    ...tweak,
    domainsText: tweak.domains.join(', '),
  }
}

export async function seedStarterTweaksIfNeeded(): Promise<TweakRecord[]> {
  const tweaks = await getTweaks()
  if (tweaks.length > 0) {
    return tweaks
  }

  await setTweaks(STARTER_TWEAKS)
  return STARTER_TWEAKS
}

export async function getTweaks(): Promise<TweakRecord[]> {
  const result = (await chrome.storage.local.get(TWEAKS_KEY)) as StorageShape
  return sortTweaks(result[TWEAKS_KEY] ?? [])
}

export async function setTweaks(tweaks: TweakRecord[]): Promise<void> {
  await chrome.storage.local.set({
    [TWEAKS_KEY]: sortTweaks(tweaks),
  } satisfies StorageShape)
}

export async function upsertTweak(tweak: TweakRecord): Promise<TweakRecord[]> {
  const tweaks = await getTweaks()
  const existingIndex = tweaks.findIndex((item) => item.id === tweak.id)

  if (existingIndex === -1) {
    await setTweaks([tweak, ...tweaks])
  } else {
    const next = [...tweaks]
    next[existingIndex] = tweak
    await setTweaks(next)
  }

  return getTweaks()
}

export async function deleteTweak(id: string): Promise<TweakRecord[]> {
  const tweaks = await getTweaks()
  await setTweaks(tweaks.filter((tweak) => tweak.id !== id))
  return getTweaks()
}

export async function toggleTweak(
  id: string,
  enabled: boolean,
): Promise<TweakRecord[]> {
  const tweaks = await getTweaks()
  await setTweaks(
    tweaks.map((tweak) =>
      tweak.id === id
        ? { ...tweak, enabled, updatedAt: new Date().toISOString() }
        : tweak,
    ),
  )
  return getTweaks()
}

export async function duplicateTweak(id: string): Promise<TweakRecord[]> {
  const tweaks = await getTweaks()
  const source = tweaks.find((tweak) => tweak.id === id)

  if (!source) {
    throw new Error('Unable to find tweak to duplicate.')
  }

  const now = new Date().toISOString()
  const clone: TweakRecord = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} Copy`,
    enabled: false,
    source: 'custom',
    createdAt: now,
    updatedAt: now,
  }

  await setTweaks([clone, ...tweaks])
  return getTweaks()
}

export function subscribeToTweaks(
  listener: (tweaks: TweakRecord[]) => void,
): () => void {
  const onChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'local' || !changes[TWEAKS_KEY]) {
      return
    }

    const nextValue = changes[TWEAKS_KEY].newValue as TweakRecord[] | undefined
    listener(sortTweaks(nextValue ?? []))
  }

  chrome.storage.onChanged.addListener(onChange)
  return () => chrome.storage.onChanged.removeListener(onChange)
}

export function setDraftKind(draft: EditorDraft, kind: TweakKind): EditorDraft {
  if (draft.kind === kind) {
    return draft
  }

  return {
    ...draft,
    kind,
    code:
      kind === 'css'
        ? '/* Add CSS selectors here. */\n'
        : "/* Return a cleanup function if your tweak needs teardown. */\nreturn (() => {\n  console.log('Tweaks Studio active on', context.hostname)\n})\n",
  }
}
