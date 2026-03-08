import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  captureExceptionOnce,
  getPublicErrorMessage,
  withSentryIsolationScope,
} from '../../src/lib/sentry-utils'

function createFakeSentry() {
  const state = {
    tags: {} as Record<string, string>,
    contexts: {} as Record<string, Record<string, unknown> | null>,
    extras: {} as Record<string, unknown>,
    captured: [] as unknown[],
  }

  const scope = {
    setTag(key: string, value: string) {
      state.tags[key] = value
    },
    setContext(key: string, value: Record<string, unknown> | null) {
      state.contexts[key] = value
    },
    setExtra(key: string, value: unknown) {
      state.extras[key] = value
    },
  }

  return {
    state,
    client: {
      withScope<T>(callback: (scope: typeof scope) => T): T {
        return callback(scope)
      },
      withIsolationScope<T>(callback: (scope: typeof scope) => T): T {
        return callback(scope)
      },
      captureException(error: unknown): string {
        state.captured.push(error)
        return 'event-id'
      },
    },
  }
}

describe('sentry-utils', () => {
  it('captures the same error only once', () => {
    const fakeSentry = createFakeSentry()
    const error = new Error('boom')

    const firstEventId = captureExceptionOnce(
      error,
      { tags: { route: 'chat' } },
      fakeSentry.client,
    )
    const secondEventId = captureExceptionOnce(
      error,
      { tags: { route: 'chat' } },
      fakeSentry.client,
    )

    assert.strictEqual(firstEventId, 'event-id')
    assert.strictEqual(secondEventId, undefined)
    assert.strictEqual(fakeSentry.state.captured.length, 1)
    assert.deepStrictEqual(fakeSentry.state.tags, { route: 'chat' })
  })

  it('skips abort errors', () => {
    const fakeSentry = createFakeSentry()
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'

    const eventId = captureExceptionOnce(abortError, {}, fakeSentry.client)

    assert.strictEqual(eventId, undefined)
    assert.strictEqual(fakeSentry.state.captured.length, 0)
  })

  it('applies tags, contexts, and extras inside an isolation scope', () => {
    const fakeSentry = createFakeSentry()

    const result = withSentryIsolationScope(
      {
        tags: { route: 'chat', is_scheduled_task: false },
        contexts: { request: { conversationId: '123' } },
        extras: { provider: 'openai' },
      },
      () => 'ok',
      fakeSentry.client,
    )

    assert.strictEqual(result, 'ok')
    assert.deepStrictEqual(fakeSentry.state.tags, {
      route: 'chat',
      is_scheduled_task: 'false',
    })
    assert.deepStrictEqual(fakeSentry.state.contexts, {
      request: { conversationId: '123' },
    })
    assert.deepStrictEqual(fakeSentry.state.extras, { provider: 'openai' })
  })

  it('returns safe public error messages', () => {
    assert.strictEqual(
      getPublicErrorMessage(new Error('provider limit exceeded')),
      'provider limit exceeded',
    )
    assert.strictEqual(getPublicErrorMessage('bad request'), 'bad request')
    assert.strictEqual(
      getPublicErrorMessage(new Error(''), 'fallback'),
      'fallback',
    )
  })
})
