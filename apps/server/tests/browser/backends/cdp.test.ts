import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import { CdpBackend } from '../../../src/browser/backends/cdp'

class MockWebSocket {
  static instances: MockWebSocket[] = []

  onopen: (() => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  readonly url: string
  sent: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.onclose?.()
  }

  open(): void {
    this.onopen?.()
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1_000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await Bun.sleep(1)
  }
  throw new Error('Timed out waiting for condition')
}

describe('CdpBackend', () => {
  const originalFetch = globalThis.fetch
  const originalWebSocket = globalThis.WebSocket
  const originalConnectTimeout = TIMEOUTS.CDP_CONNECT
  const originalReconnectDelay = TIMEOUTS.CDP_RECONNECT_DELAY
  let fetchUrls: string[] = []

  beforeEach(() => {
    MockWebSocket.instances = []
    fetchUrls = []

    ;(TIMEOUTS as unknown as { CDP_CONNECT: number }).CDP_CONNECT = 200
    ;(
      TIMEOUTS as unknown as { CDP_RECONNECT_DELAY: number }
    ).CDP_RECONNECT_DELAY = 1

    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchUrls.push(String(input))
      const id = fetchUrls.length
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          webSocketDebuggerUrl: `ws://127.0.0.1:9222/devtools/browser/${id}`,
        }),
      } as Response
    }) as typeof fetch

    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
    ;(TIMEOUTS as unknown as { CDP_CONNECT: number }).CDP_CONNECT =
      originalConnectTimeout
    ;(
      TIMEOUTS as unknown as { CDP_RECONNECT_DELAY: number }
    ).CDP_RECONNECT_DELAY = originalReconnectDelay
  })

  it('uses 127.0.0.1 for /json/version requests', async () => {
    const cdp = new CdpBackend({ port: 9222 })
    const connectPromise = cdp.connect()

    await waitFor(() => MockWebSocket.instances.length === 1)
    MockWebSocket.instances[0]?.open()
    await connectPromise

    assert.strictEqual(fetchUrls[0], 'http://127.0.0.1:9222/json/version')
    await cdp.disconnect()
  })

  it('reconnects again when a socket closes during reconnect', async () => {
    const cdp = new CdpBackend({ port: 9222 })
    const connectPromise = cdp.connect()

    await waitFor(() => MockWebSocket.instances.length === 1)
    const ws1 = MockWebSocket.instances[0]
    ws1?.open()
    await connectPromise
    assert.strictEqual(cdp.isConnected(), true)

    ws1?.close()

    await waitFor(() => MockWebSocket.instances.length >= 2)
    const ws2 = MockWebSocket.instances[1]
    ws2?.open()
    ws2?.close()

    await waitFor(() => MockWebSocket.instances.length >= 3)
    const ws3 = MockWebSocket.instances[2]
    ws3?.open()

    await waitFor(() => cdp.isConnected())
    assert.strictEqual(cdp.isConnected(), true)
    assert(fetchUrls.length >= 3)
    await cdp.disconnect()
  })
})
