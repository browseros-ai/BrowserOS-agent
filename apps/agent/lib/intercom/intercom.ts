export type IntercomBootCommand = {
  type: 'intercom:boot'
  appId: string
}

export type IntercomUpdateCommand = {
  type: 'intercom:update'
  userId: string
  email: string
  name: string
}

export type IntercomShutdownCommand = {
  type: 'intercom:shutdown'
}

export type IntercomParentMessage =
  | IntercomBootCommand
  | IntercomUpdateCommand
  | IntercomShutdownCommand

export type IntercomReadyEvent = {
  type: 'intercom:ready'
}

export type IntercomMessengerOpenedEvent = {
  type: 'intercom:messenger-opened'
}

export type IntercomMessengerClosedEvent = {
  type: 'intercom:messenger-closed'
}

export type IntercomSandboxEvent =
  | IntercomReadyEvent
  | IntercomMessengerOpenedEvent
  | IntercomMessengerClosedEvent

export const INTERCOM_LAUNCHER_WIDTH = 80
export const INTERCOM_LAUNCHER_HEIGHT = 80
export const INTERCOM_MESSENGER_WIDTH = 420
export const INTERCOM_MESSENGER_HEIGHT = 650

const KNOWN_SANDBOX_EVENT_TYPES = new Set([
  'intercom:ready',
  'intercom:messenger-opened',
  'intercom:messenger-closed',
])

export function isIntercomSandboxEvent(
  data: unknown,
): data is IntercomSandboxEvent {
  if (typeof data !== 'object' || data === null) return false
  const msg = data as { type?: unknown }
  if (typeof msg.type !== 'string') return false
  return KNOWN_SANDBOX_EVENT_TYPES.has(msg.type)
}
