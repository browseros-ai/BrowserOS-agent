// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export interface ConsoleMessage {
  source:
    | 'xml'
    | 'javascript'
    | 'network'
    | 'console-api'
    | 'storage'
    | 'appcache'
    | 'rendering'
    | 'security'
    | 'other'
    | 'deprecation'
    | 'worker'
  level: 'log' | 'warning' | 'error' | 'debug' | 'info'
  text: string
  url?: string
  line?: number
  column?: number
}

// ══ Commands ══

// ══ Events ══

export interface MessageAddedEvent {
  message: ConsoleMessage
}
