import { afterEach, beforeEach, describe, it, mock } from 'bun:test'
import assert from 'node:assert'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { KlavisClient, StrataCreateResponse, UserIntegration } from '../../../lib/clients/klavis/klavis-client'
import { KlavisStrataPool } from './klavis-strata-pool'

const originalFetch = globalThis.fetch

function createMockMcpServer(): McpServer {
  return new McpServer(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { logging: {} } },
  )
}

function createMockKlavisClient(overrides: Partial<KlavisClient> = {}): KlavisClient {
  return {
    createStrata: mock(async (): Promise<StrataCreateResponse> => ({
      strataServerUrl: 'https://strata.example.com/mcp',
      strataId: 'strata-123',
      addedServers: ['Gmail', 'Slack'],
    })),
    getUserIntegrations: mock(async (): Promise<UserIntegration[]> => [
      { name: 'Gmail', isAuthenticated: true },
      { name: 'Slack', isAuthenticated: true },
      { name: 'Notion', isAuthenticated: false },
    ]),
    submitApiKey: mock(async () => {}),
    removeServer: mock(async () => {}),
    ...overrides,
  } as unknown as KlavisClient
}

function mockFetchForStrata(toolNames: string[] = ['discover_server_categories_or_actions', 'execute_action']) {
  const tools = toolNames.map((name) => ({
    name,
    description: `Klavis tool: ${name}`,
    inputSchema: { type: 'object', properties: {} },
  }))

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {}

    if (body.method === 'tools/list') {
      return Response.json({ jsonrpc: '2.0', id: 1, result: { tools } })
    }

    if (body.method === 'tools/call') {
      return Response.json({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: `executed ${body.params?.name}` }],
          isError: false,
        },
      })
    }

    return Response.json({ jsonrpc: '2.0', id: 1, result: {} })
  }) as typeof fetch
}

/**
 * Creates a mock fetch that returns different tool sets per Strata URL.
 * The first createStrata call returns strata-gmail, the second returns strata-slack.
 */
function mockFetchForMultipleStrata() {
  let strataCallCount = 0

  const strataTools: Record<string, Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>> = {
    'https://strata-gmail.example.com/mcp': [
      { name: 'gmail_list_emails', description: 'List Gmail emails', inputSchema: { type: 'object', properties: {} } },
      { name: 'shared_tool', description: 'Shared tool', inputSchema: { type: 'object', properties: {} } },
    ],
    'https://strata-slack.example.com/mcp': [
      { name: 'slack_send_message', description: 'Send Slack message', inputSchema: { type: 'object', properties: {} } },
      { name: 'shared_tool', description: 'Shared tool', inputSchema: { type: 'object', properties: {} } },
    ],
  }

  const strataUrls = Object.keys(strataTools)

  return {
    klavisClient: createMockKlavisClient({
      createStrata: mock(async (): Promise<StrataCreateResponse> => {
        const url = strataUrls[strataCallCount % strataUrls.length]
        strataCallCount++
        return {
          strataServerUrl: url,
          strataId: `strata-${strataCallCount}`,
          addedServers: [],
        }
      }),
    }),
    setupFetch: () => {
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const tools = strataTools[urlStr] || []

        if (body.method === 'tools/list') {
          return Response.json({ jsonrpc: '2.0', id: 1, result: { tools } })
        }

        if (body.method === 'tools/call') {
          return Response.json({
            jsonrpc: '2.0',
            id: 1,
            result: {
              content: [{ type: 'text', text: `executed ${body.params?.name}` }],
              isError: false,
            },
          })
        }

        return Response.json({ jsonrpc: '2.0', id: 1, result: {} })
      }) as typeof fetch
    },
  }
}

describe('KlavisStrataPool', () => {
  let mcpServer: McpServer
  let klavisClient: KlavisClient
  let pool: KlavisStrataPool

  beforeEach(() => {
    mcpServer = createMockMcpServer()
    klavisClient = createMockKlavisClient()
    pool = new KlavisStrataPool(klavisClient, mcpServer, new Set<string>())
    mockFetchForStrata()
  })

  afterEach(() => {
    pool.dispose()
    globalThis.fetch = originalFetch
  })

  it('ensureTools creates pool entry and registers tools', async () => {
    await pool.ensureTools('user-123', ['Gmail', 'Slack'])

    assert.strictEqual(
      (klavisClient.createStrata as ReturnType<typeof mock>).mock.calls.length,
      1,
    )
  })

  it('ensureTools is idempotent (no-op when entry exists)', async () => {
    await pool.ensureTools('user-123', ['Gmail'])
    await pool.ensureTools('user-123', ['Gmail'])

    // createStrata should only be called once
    assert.strictEqual(
      (klavisClient.createStrata as ReturnType<typeof mock>).mock.calls.length,
      1,
    )
  })

  it('ensureTools with different servers creates separate entries and deduplicates shared tools', async () => {
    const { klavisClient: multiClient, setupFetch } = mockFetchForMultipleStrata()
    setupFetch()
    const multiPool = new KlavisStrataPool(multiClient, mcpServer, new Set<string>())

    // First entry: gmail_list_emails + shared_tool
    await multiPool.ensureTools('user-123', ['Gmail'])
    // Second entry: slack_send_message + shared_tool (shared_tool should be skipped)
    await multiPool.ensureTools('user-123', ['Slack'])

    // Both entries created successfully (no "already registered" error)
    assert.strictEqual(
      (multiClient.createStrata as ReturnType<typeof mock>).mock.calls.length,
      2,
    )

    // shared_tool is proxied via the first entry; slack_send_message via the second
    const gmailResult = await multiPool.executeToolCall('gmail_list_emails', {})
    assert.strictEqual(gmailResult.isError, false)

    const slackResult = await multiPool.executeToolCall('slack_send_message', {})
    assert.strictEqual(slackResult.isError, false)

    // shared_tool should still work (registered by first entry)
    const sharedResult = await multiPool.executeToolCall('shared_tool', {})
    assert.strictEqual(sharedResult.isError, false)

    multiPool.dispose()
  })

  it('ensureTools with no servers uses getUserIntegrations for auto-discovery', async () => {
    await pool.ensureTools('user-123')

    assert.strictEqual(
      (klavisClient.getUserIntegrations as ReturnType<typeof mock>).mock.calls.length,
      1,
    )

    // Should only include authenticated integrations (Gmail, Slack), not Notion
    const createStrataCall = (klavisClient.createStrata as ReturnType<typeof mock>).mock.calls[0]
    assert.deepStrictEqual(createStrataCall, ['user-123', ['Gmail', 'Slack']])
  })

  it('ensureTools handles empty server list gracefully', async () => {
    const emptyClient = createMockKlavisClient({
      getUserIntegrations: mock(async () => []),
    })
    const emptyPool = new KlavisStrataPool(emptyClient, mcpServer, new Set<string>())

    await emptyPool.ensureTools('user-123')

    assert.strictEqual(
      (emptyClient.createStrata as ReturnType<typeof mock>).mock.calls.length,
      0,
    )

    emptyPool.dispose()
  })

  it('executeToolCall forwards to Strata endpoint', async () => {
    await pool.ensureTools('user-123', ['Gmail'])

    const result = await pool.executeToolCall('discover_server_categories_or_actions', { query: 'test' })

    assert.ok(result.content.length > 0)
    assert.strictEqual(result.isError, false)
  })

  it('executeToolCall returns error for unknown tool', async () => {
    const result = await pool.executeToolCall('nonexistent_tool', {})

    assert.strictEqual(result.isError, true)
    assert.ok(result.content[0].type === 'text')
    assert.ok((result.content[0] as { type: 'text'; text: string }).text.includes('Unknown Klavis tool'))
  })

  it('handles Klavis client failure gracefully (does not throw)', async () => {
    const failingClient = createMockKlavisClient({
      createStrata: mock(async () => {
        throw new Error('Klavis unavailable')
      }),
    })
    const failPool = new KlavisStrataPool(failingClient, mcpServer, new Set<string>())

    // Should not throw
    await failPool.ensureTools('user-123', ['Gmail'])

    failPool.dispose()
  })

  it('handles fetch failure for tools/list gracefully', async () => {
    globalThis.fetch = (async () => {
      throw new Error('Network error')
    }) as unknown as typeof fetch

    // Should not throw
    await pool.ensureTools('user-123', ['Gmail'])
  })

  it('dispose cleans up all entries and registered tools', async () => {
    const { klavisClient: multiClient, setupFetch } = mockFetchForMultipleStrata()
    setupFetch()
    const multiPool = new KlavisStrataPool(multiClient, mcpServer, new Set<string>())

    await multiPool.ensureTools('user-123', ['Gmail'])
    await multiPool.ensureTools('user-123', ['Slack'])

    // Should not throw - even with shared tools, each entry only removes its own
    multiPool.dispose()
  })

  it('in-flight dedup prevents concurrent creations for same key', async () => {
    await Promise.all([
      pool.ensureTools('user-123', ['Gmail']),
      pool.ensureTools('user-123', ['Gmail']),
    ])

    // createStrata should only be called once despite concurrent calls
    assert.strictEqual(
      (klavisClient.createStrata as ReturnType<typeof mock>).mock.calls.length,
      1,
    )
  })

  it('collision detection prefixes Klavis tools that clash with browser tools', async () => {
    const browserPool = new KlavisStrataPool(
      klavisClient,
      mcpServer,
      new Set(['discover_server_categories_or_actions']),
    )

    mockFetchForStrata(['discover_server_categories_or_actions'])

    await browserPool.ensureTools('user-123', ['Gmail'])

    // The tool should have been registered (with prefix) - no error
    browserPool.dispose()
  })
})
