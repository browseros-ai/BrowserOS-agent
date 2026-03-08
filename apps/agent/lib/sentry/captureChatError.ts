import { sentry } from './sentry'

const CAPTURED_ERROR_SYMBOL = Symbol.for('browseros.agent.sentry.captured')

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error(typeof error === 'string' ? error : String(error))
}

export function captureChatError(
  error: unknown,
  context: { surface: string } & Record<string, unknown>,
): void {
  if (error instanceof Error && error.name === 'AbortError') {
    return
  }

  if (isRecord(error) && error[CAPTURED_ERROR_SYMBOL] === true) {
    return
  }

  const normalizedError = toError(error)

  sentry.captureException(normalizedError, {
    tags: {
      surface: context.surface,
    },
    extra: context,
  })

  if (!isRecord(error)) {
    return
  }

  try {
    error[CAPTURED_ERROR_SYMBOL] = true
  } catch {}
}
