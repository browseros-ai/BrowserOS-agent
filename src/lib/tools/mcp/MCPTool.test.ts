import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MCPTool } from './MCPTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { KlavisAPIManager } from '@/lib/mcp/KlavisAPIManager'

// Mock the KlavisAPIManager
vi.mock('@/lib/mcp/KlavisAPIManager', () => ({
  KlavisAPIManager: {
    getInstance: vi.fn()
  }
}))

describe('MCPTool', () => {
  let mcpTool: MCPTool
  let mockExecutionContext: ExecutionContext
  let mockManager: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Create mock manager
    mockManager = {
      getInstalledServers: vi.fn(),
      client: {
        listTools: vi.fn(),
        callTool: vi.fn()
      }
    }
    
    // Mock execution context
    mockExecutionContext = {
      getKlavisAPIManager: vi.fn().mockReturnValue(mockManager)
    } as any
    
    // Create MCPTool instance
    mcpTool = new MCPTool(mockExecutionContext)
  })

  it('tests that MCPTool can be created with execution context', () => {
    expect(mcpTool).toBeDefined()
    expect(mockExecutionContext.getKlavisAPIManager).toHaveBeenCalled()
  })

  it('tests that getUserInstances returns empty list when no servers installed', async () => {
    mockManager.getInstalledServers.mockResolvedValue([])
    
    const result = await mcpTool.execute({ action: 'getUserInstances' })
    
    expect(result.ok).toBe(true)
    const output = JSON.parse(result.output)
    expect(output.instances).toEqual([])
    expect(output.message).toContain('No MCP servers installed')
  })

  it('tests that getUserInstances returns formatted server list', async () => {
    mockManager.getInstalledServers.mockResolvedValue([
      {
        name: 'Gmail',
        serverUrl: 'https://gmail.klavis.ai/123',
        isAuthenticated: true,
        authNeeded: false,
        tools: [{ name: 'send_email' }, { name: 'read_email' }]
      }
    ])
    
    const result = await mcpTool.execute({ action: 'getUserInstances' })
    
    expect(result.ok).toBe(true)
    const output = JSON.parse(result.output)
    expect(output.instances).toHaveLength(1)
    expect(output.instances[0].name).toBe('Gmail')
    expect(output.instances[0].toolCount).toBe(2)
  })

  it('tests that listTools returns error when serverUrl is missing', async () => {
    const result = await mcpTool.execute({ action: 'listTools' })
    
    expect(result.ok).toBe(false)
    expect(result.output).toContain('serverUrl is required')
  })

  it('tests that callTool returns error when required params are missing', async () => {
    const result = await mcpTool.execute({ 
      action: 'callTool',
      serverUrl: 'https://test.com'
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toContain('toolName is required')
  })

  it('tests that unknown action returns error', async () => {
    const result = await mcpTool.execute({ action: 'unknownAction' as any })
    
    expect(result.ok).toBe(false)
    expect(result.output).toContain('Unknown action')
  })
})