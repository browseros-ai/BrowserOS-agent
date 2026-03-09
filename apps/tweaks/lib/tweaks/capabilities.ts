import type { CapabilitySignal, TweakRecord } from './types'

const signalMatchers: Array<{ signal: CapabilitySignal; pattern: RegExp }> = [
  {
    signal: 'network',
    pattern: /\b(fetch|XMLHttpRequest|navigator\.sendBeacon)\b/,
  },
  {
    signal: 'clipboard',
    pattern: /\b(navigator\.clipboard|execCommand\(['"]copy)/,
  },
  {
    signal: 'notifications',
    pattern: /\b(Notification|chrome\.notifications)\b/,
  },
  {
    signal: 'storage',
    pattern: /\b(localStorage|sessionStorage|indexedDB|chrome\.storage)\b/,
  },
]

export function getCapabilitySignals(tweak: TweakRecord): CapabilitySignal[] {
  const found = new Set<CapabilitySignal>()

  for (const matcher of signalMatchers) {
    if (matcher.pattern.test(tweak.code)) {
      found.add(matcher.signal)
    }
  }

  return [...found]
}

export function formatCapabilitySignal(signal: CapabilitySignal): string {
  switch (signal) {
    case 'network':
      return 'Network'
    case 'clipboard':
      return 'Clipboard'
    case 'notifications':
      return 'Notifications'
    case 'storage':
      return 'Storage'
  }
}
