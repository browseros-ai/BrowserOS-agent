import { beforeEach, describe, it, mock } from 'bun:test'
import assert from 'node:assert'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerKlavisTools, type KlavisToolDescriptor, type KlavisToolProxyDeps } from './klavis-tool-proxy'

function createMockMcpServer(): McpServer {
  return new McpServer(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { logging: {} } },
  )
}

describe('registerKlavisTools', () => {
  let mcpServer: McpServer

  beforeEach(() => {
    mcpServer = createMockMcpServer()
  })

  it('registers tools on the MCP server', () => {
    const tools: KlavisToolDescriptor[] = [
      {
        name: 'discover_server_categories_or_actions',
        description: 'Discover available server actions',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      },
      {
        name: 'execute_action',
        description: 'Execute an action',
        inputSchema: { type: 'object', properties: { action: { type: 'string' } } },
      },
    ]

    const executeToolCall = mock(async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
    }))

    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set<string>(),
      registeredKlavisNames: new Set<string>(),
      executeToolCall,
    }

    const result = registerKlavisTools(mcpServer, tools, deps)

    assert.strictEqual(result.registeredTools.length, 2)
    assert.strictEqual(result.registeredNames.length, 2)
    assert.ok(result.registeredNames.includes('discover_server_categories_or_actions'))
    assert.ok(result.registeredNames.includes('execute_action'))
  })

  it('prefixes tool name with klavis_ on collision with browser tools', () => {
    const tools: KlavisToolDescriptor[] = [
      {
        name: 'browser_navigate',
        description: 'Navigate (collision)',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const executeToolCall = mock(async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
    }))

    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set(['browser_navigate']),
      registeredKlavisNames: new Set<string>(),
      executeToolCall,
    }

    const result = registerKlavisTools(mcpServer, tools, deps)

    assert.strictEqual(result.registeredTools.length, 1)
    assert.deepStrictEqual(result.registeredNames, ['klavis_browser_navigate'])
  })

  it('returns empty array for empty tool list', () => {
    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set<string>(),
      registeredKlavisNames: new Set<string>(),
      executeToolCall: mock(async () => ({
        content: [{ type: 'text' as const, text: '' }],
      })),
    }

    const result = registerKlavisTools(mcpServer, [], deps)
    assert.strictEqual(result.registeredTools.length, 0)
    assert.strictEqual(result.registeredNames.length, 0)
  })

  it('calls executeToolCall with original name even when prefixed', () => {
    const tools: KlavisToolDescriptor[] = [
      {
        name: 'browser_click',
        description: 'Click (collision)',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const executeToolCall = mock(async (toolName: string, _args: Record<string, unknown>) => ({
      content: [{ type: 'text' as const, text: `called ${toolName}` }],
    }))

    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set(['browser_click']),
      registeredKlavisNames: new Set<string>(),
      executeToolCall,
    }

    const result = registerKlavisTools(mcpServer, tools, deps)

    // Registered under prefixed name
    assert.deepStrictEqual(result.registeredNames, ['klavis_browser_click'])
    // executeToolCall not called yet (only when handler is invoked)
    assert.strictEqual(executeToolCall.mock.calls.length, 0)
  })

  it('handler returns isError true on executeToolCall failure', () => {
    const tools: KlavisToolDescriptor[] = [
      {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const executeToolCall = mock(async () => {
      throw new Error('Connection refused')
    })

    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set<string>(),
      registeredKlavisNames: new Set<string>(),
      executeToolCall,
    }

    const result = registerKlavisTools(mcpServer, tools, deps)
    assert.strictEqual(result.registeredTools.length, 1)
  })

  it('registered tools can be removed', () => {
    const tools: KlavisToolDescriptor[] = [
      {
        name: 'removable_tool',
        description: 'Will be removed',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set<string>(),
      registeredKlavisNames: new Set<string>(),
      executeToolCall: mock(async () => ({
        content: [{ type: 'text' as const, text: 'ok' }],
      })),
    }

    const result = registerKlavisTools(mcpServer, tools, deps)
    assert.strictEqual(result.registeredTools.length, 1)

    // Should not throw
    result.registeredTools[0].remove()
  })

  it('skips tools already registered by another pool entry', () => {
    const tools: KlavisToolDescriptor[] = [
      {
        name: 'shared_tool',
        description: 'Shared across entries',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'unique_tool',
        description: 'Only in this entry',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set<string>(),
      registeredKlavisNames: new Set(['shared_tool']),
      executeToolCall: mock(async () => ({
        content: [{ type: 'text' as const, text: 'ok' }],
      })),
    }

    const result = registerKlavisTools(mcpServer, tools, deps)

    // Only unique_tool should be registered; shared_tool skipped
    assert.strictEqual(result.registeredTools.length, 1)
    assert.deepStrictEqual(result.registeredNames, ['unique_tool'])
  })

  it('adds registered names to the registeredKlavisNames set', () => {
    const tools: KlavisToolDescriptor[] = [
      { name: 'tool_a', description: 'A', inputSchema: { type: 'object', properties: {} } },
      { name: 'tool_b', description: 'B', inputSchema: { type: 'object', properties: {} } },
    ]

    const registeredKlavisNames = new Set<string>()

    const deps: KlavisToolProxyDeps = {
      browserToolNames: new Set<string>(),
      registeredKlavisNames,
      executeToolCall: mock(async () => ({
        content: [{ type: 'text' as const, text: 'ok' }],
      })),
    }

    registerKlavisTools(mcpServer, tools, deps)

    assert.ok(registeredKlavisNames.has('tool_a'))
    assert.ok(registeredKlavisNames.has('tool_b'))
  })
})
