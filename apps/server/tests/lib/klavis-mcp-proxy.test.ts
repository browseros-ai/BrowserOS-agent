/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { afterEach, beforeEach, describe, it, mock } from 'bun:test'
import assert from 'node:assert'

// Mock MCP SDK modules before importing KlavisMcpProxy
const mockConnect = mock(() => Promise.resolve())
const mockListTools = mock(() =>
  Promise.resolve({
    tools: [
      {
        name: 'discover_server_categories_or_actions',
        description: 'Discover available server categories',
        inputSchema: { type: 'object' as const },
      },
      {
        name: 'execute_action',
        description: 'Execute an action',
        inputSchema: { type: 'object' as const },
      },
    ],
  }),
)
const mockCallTool = mock(() =>
  Promise.resolve({
    content: [{ type: 'text', text: 'tool result' }],
  }),
)
const mockTransportClose = mock(() => Promise.resolve())

mock.module('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class MockClient {
    connect = mockConnect
    listTools = mockListTools
    callTool = mockCallTool
  },
}))

mock.module('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class MockTransport {
    close = mockTransportClose
  },
}))

import { KlavisMcpProxy } from '../../src/lib/klavis-mcp-proxy'

function createMockKlavisClient(
  overrides: {
    getUserIntegrations?: () => Promise<
      Array<{ name: string; isAuthenticated: boolean }>
    >
    createStrata?: () => Promise<{
      strataServerUrl: string
      strataId: string
      addedServers: string[]
    }>
  } = {},
) {
  return {
    getUserIntegrations:
      overrides.getUserIntegrations ??
      mock(() =>
        Promise.resolve([
          { name: 'Gmail', isAuthenticated: true },
          { name: 'Slack', isAuthenticated: false },
        ]),
      ),
    createStrata:
      overrides.createStrata ??
      mock(() =>
        Promise.resolve({
          strataServerUrl: 'http://strata.test/mcp',
          strataId: 'test-strata',
          addedServers: ['Gmail'],
        }),
      ),
    submitApiKey: mock(() => Promise.resolve()),
    removeServer: mock(() => Promise.resolve()),
  } as unknown as ConstructorParameters<typeof KlavisMcpProxy>[0]
}

describe('KlavisMcpProxy', () => {
  let proxy: KlavisMcpProxy

  beforeEach(() => {
    mockConnect.mockClear()
    mockListTools.mockClear()
    mockCallTool.mockClear()
    mockTransportClose.mockClear()
  })

  afterEach(async () => {
    if (proxy) {
      await proxy.disconnect()
    }
  })

  it('connect() fetches authenticated integrations and connects to Strata', async () => {
    const klavisClient = createMockKlavisClient()
    proxy = new KlavisMcpProxy(klavisClient, 'test-browseros-id')

    await proxy.connect()

    assert.strictEqual(proxy.isConnected(), true)
    assert.strictEqual(proxy.getTools().length, 2)
    assert.strictEqual(
      proxy.getTools()[0].name,
      'discover_server_categories_or_actions',
    )
    assert.strictEqual(proxy.getTools()[1].name, 'execute_action')
    assert.strictEqual(klavisClient.getUserIntegrations.mock.calls.length, 1)
    assert.strictEqual(klavisClient.createStrata.mock.calls.length, 1)
    assert.strictEqual(mockConnect.mock.calls.length, 1)
    assert.strictEqual(mockListTools.mock.calls.length, 1)
  })

  it('connect() with no authenticated integrations — no connection, empty tools', async () => {
    const klavisClient = createMockKlavisClient({
      getUserIntegrations: mock(() =>
        Promise.resolve([
          { name: 'Gmail', isAuthenticated: false },
          { name: 'Slack', isAuthenticated: false },
        ]),
      ),
    })
    proxy = new KlavisMcpProxy(klavisClient, 'test-browseros-id')

    await proxy.connect()

    assert.strictEqual(proxy.isConnected(), false)
    assert.deepStrictEqual(proxy.getTools(), [])
    assert.strictEqual(klavisClient.createStrata.mock.calls.length, 0)
    assert.strictEqual(mockConnect.mock.calls.length, 0)
  })

  it('callTool() delegates to upstream client', async () => {
    const klavisClient = createMockKlavisClient()
    proxy = new KlavisMcpProxy(klavisClient, 'test-browseros-id')
    await proxy.connect()

    const result = await proxy.callTool(
      'discover_server_categories_or_actions',
      { query: 'email' },
    )

    assert.strictEqual(mockCallTool.mock.calls.length, 1)
    const callArgs = mockCallTool.mock.calls[0]
    assert.deepStrictEqual(callArgs[0], {
      name: 'discover_server_categories_or_actions',
      arguments: { query: 'email' },
    })
    assert.ok(result.content)
    assert.strictEqual(
      (result.content as Array<{ type: string; text: string }>)[0].text,
      'tool result',
    )
  })

  it('callTool() when disconnected returns error result', async () => {
    const klavisClient = createMockKlavisClient()
    proxy = new KlavisMcpProxy(klavisClient, 'test-browseros-id')

    const result = await proxy.callTool('some_tool', {})

    assert.strictEqual(result.isError, true)
    assert.strictEqual(
      (result.content as Array<{ type: string; text: string }>)[0].text,
      'Klavis MCP proxy is not connected',
    )
  })

  it('refresh() triggers onToolsChanged when server set changes', async () => {
    let callCount = 0
    const klavisClient = createMockKlavisClient({
      getUserIntegrations: mock(() => {
        callCount++
        if (callCount <= 1) {
          return Promise.resolve([{ name: 'Gmail', isAuthenticated: true }])
        }
        return Promise.resolve([
          { name: 'Gmail', isAuthenticated: true },
          { name: 'Slack', isAuthenticated: true },
        ])
      }),
    })

    proxy = new KlavisMcpProxy(klavisClient, 'test-browseros-id')
    await proxy.connect()

    const onToolsChanged = mock(() => {})
    proxy.onToolsChanged = onToolsChanged

    await proxy.refresh()

    // onToolsChanged is called both during reconnect (via connect()) and should be triggered
    assert.ok(
      onToolsChanged.mock.calls.length >= 1,
      'onToolsChanged should have been called at least once',
    )
  })

  it('refresh() is a no-op when server set is unchanged', async () => {
    const klavisClient = createMockKlavisClient({
      getUserIntegrations: mock(() =>
        Promise.resolve([{ name: 'Gmail', isAuthenticated: true }]),
      ),
    })

    proxy = new KlavisMcpProxy(klavisClient, 'test-browseros-id')
    await proxy.connect()

    const connectCallsBefore = mockConnect.mock.calls.length

    const onToolsChanged = mock(() => {})
    proxy.onToolsChanged = onToolsChanged

    await proxy.refresh()

    // Should not have reconnected
    assert.strictEqual(mockConnect.mock.calls.length, connectCallsBefore)
    assert.strictEqual(onToolsChanged.mock.calls.length, 0)
  })

  it('connect() failure is graceful', async () => {
    const klavisClient = createMockKlavisClient({
      getUserIntegrations: mock(() => {
        throw new Error('Network error')
      }),
    })

    proxy = new KlavisMcpProxy(klavisClient, 'test-browseros-id')

    // Should not throw
    await proxy.connect()

    assert.strictEqual(proxy.isConnected(), false)
    assert.deepStrictEqual(proxy.getTools(), [])
  })
})
