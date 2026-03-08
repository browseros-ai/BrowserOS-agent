import { Sentry } from './sentry'

const CAPTURED_ERROR_SYMBOL = Symbol.for('browseros.sentry.captured')

interface SentryScopeLike {
  setTag(key: string, value: string): void
  setContext(key: string, value: Record<string, unknown> | null): void
  setExtra(key: string, value: unknown): void
}

interface SentryClientLike {
  withScope<T>(callback: (scope: SentryScopeLike) => T): T
  withIsolationScope<T>(callback: (scope: SentryScopeLike) => T): T
  captureException(error: unknown): string
}

type SentryMetadataMap = Record<string, unknown>

export interface SentryMetadata {
  tags?: SentryMetadataMap
  contexts?: Record<string, Record<string, unknown> | null | undefined>
  extras?: SentryMetadataMap
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeTagValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  return String(value)
}

function applyMetadata(
  scope: SentryScopeLike,
  metadata?: SentryMetadata,
): void {
  if (!metadata) {
    return
  }

  if (metadata.tags) {
    for (const [key, value] of Object.entries(metadata.tags)) {
      const normalizedValue = normalizeTagValue(value)
      if (normalizedValue !== undefined) {
        scope.setTag(key, normalizedValue)
      }
    }
  }

  if (metadata.contexts) {
    for (const [key, value] of Object.entries(metadata.contexts)) {
      if (value !== undefined) {
        scope.setContext(key, value)
      }
    }
  }

  if (metadata.extras) {
    for (const [key, value] of Object.entries(metadata.extras)) {
      if (value !== undefined) {
        scope.setExtra(key, value)
      }
    }
  }
}

function markErrorAsCaptured(error: unknown): void {
  if (!isRecord(error)) {
    return
  }

  try {
    error[CAPTURED_ERROR_SYMBOL] = true
  } catch {}
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function isErrorCaptured(error: unknown): boolean {
  return isRecord(error) && error[CAPTURED_ERROR_SYMBOL] === true
}

export function withSentryIsolationScope<T>(
  metadata: SentryMetadata,
  callback: () => T,
  sentryClient: SentryClientLike = Sentry,
): T {
  return sentryClient.withIsolationScope((scope) => {
    applyMetadata(scope, metadata)
    return callback()
  })
}

export function captureExceptionOnce(
  error: unknown,
  metadata?: SentryMetadata,
  sentryClient: SentryClientLike = Sentry,
): string | undefined {
  if (isAbortError(error) || isErrorCaptured(error)) {
    return undefined
  }

  return sentryClient.withScope((scope) => {
    applyMetadata(scope, metadata)
    const eventId = sentryClient.captureException(error)
    markErrorAsCaptured(error)
    return eventId
  })
}

export function getPublicErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred',
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}
