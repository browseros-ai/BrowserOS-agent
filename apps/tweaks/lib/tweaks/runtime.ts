import { tweakMatchesUrl } from './match'
import { getTweaks, subscribeToTweaks } from './storage'
import type { TweakRecord } from './types'

const STYLE_PREFIX = 'browseros-tweak-style'

type Cleanup = () => void
type ActiveJsMap = Map<string, { fingerprint: string; cleanup?: Cleanup }>

const activeJavaScript: ActiveJsMap = new Map()
let lastUrl = location.href

function getFingerprint(tweak: TweakRecord): string {
  return `${tweak.updatedAt}:${tweak.code}`
}

function getMatchingTweaks(tweaks: TweakRecord[]): TweakRecord[] {
  return tweaks.filter(
    (tweak) => tweak.enabled && tweakMatchesUrl(tweak.domains, location.href),
  )
}

function cleanupJavaScript(id: string): void {
  const active = activeJavaScript.get(id)
  try {
    active?.cleanup?.()
  } catch (error) {
    console.error('Tweaks Studio cleanup failed', error)
  }
  activeJavaScript.delete(id)
}

function syncCssTweaks(tweaks: TweakRecord[]): void {
  const activeIds = new Set<string>()

  for (const tweak of tweaks.filter((item) => item.kind === 'css')) {
    activeIds.add(tweak.id)
    const elementId = `${STYLE_PREFIX}-${tweak.id}`
    let style = document.getElementById(elementId) as HTMLStyleElement | null

    if (!style) {
      style = document.createElement('style')
      style.id = elementId
      style.dataset.tweakId = tweak.id
      document.documentElement.append(style)
    }

    if (style.textContent !== tweak.code) {
      style.textContent = tweak.code
    }
  }

  for (const style of document.querySelectorAll<HTMLStyleElement>(
    `style[id^="${STYLE_PREFIX}-"]`,
  )) {
    const tweakId = style.dataset.tweakId
    if (tweakId && !activeIds.has(tweakId)) {
      style.remove()
    }
  }
}

function syncJavaScriptTweaks(tweaks: TweakRecord[]): void {
  const jsTweaks = tweaks.filter((item) => item.kind === 'javascript')
  const activeIds = new Set(jsTweaks.map((tweak) => tweak.id))

  for (const id of activeJavaScript.keys()) {
    if (!activeIds.has(id)) {
      cleanupJavaScript(id)
    }
  }

  for (const tweak of jsTweaks) {
    const fingerprint = getFingerprint(tweak)
    const current = activeJavaScript.get(tweak.id)

    if (current?.fingerprint === fingerprint) {
      continue
    }

    cleanupJavaScript(tweak.id)

    try {
      const executor = new Function('context', tweak.code)
      const result = executor({
        hostname: location.hostname,
        href: location.href,
        tweakName: tweak.name,
        log: (...args: unknown[]) =>
          console.log(`[Tweaks:${tweak.name}]`, ...args),
      })

      activeJavaScript.set(tweak.id, {
        fingerprint,
        cleanup: typeof result === 'function' ? (result as Cleanup) : undefined,
      })
    } catch (error) {
      console.error(`Tweaks Studio failed to run "${tweak.name}"`, error)
    }
  }
}

async function applyCurrentTweaks(): Promise<void> {
  const tweaks = await getTweaks()
  const matchingTweaks = getMatchingTweaks(tweaks)
  syncCssTweaks(matchingTweaks)
  syncJavaScriptTweaks(matchingTweaks)
}

export async function startTweakRuntime(): Promise<() => void> {
  await applyCurrentTweaks()

  const rerun = () => {
    applyCurrentTweaks().catch((error) => {
      console.error('Tweaks Studio failed to refresh', error)
    })
  }

  const unsubscribe = subscribeToTweaks(() => rerun())
  const interval = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      rerun()
    }
  }, 1000)

  return () => {
    window.clearInterval(interval)
    unsubscribe()
    for (const id of [...activeJavaScript.keys()]) {
      cleanupJavaScript(id)
    }
  }
}
