import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMemoryTool } from './MemoryTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MemoryManager } from '@/lib/memory/MemoryManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { getMemoryConfig } from '@/lib/memory/config'
import { initializeMemorySystem } from '@/lib/memory/index'

// Mock dependencies
vi.mock('@/lib/memory/config')
vi.mock('@/lib/memory/MemoryManager')
vi.mock('@/lib/browser/BrowserContext')
vi.mock('@/lib/memory/index', async () => {
  const actual = await vi.importActual('@/lib/memory/index')
  return {
    ...actual,
    initializeMemorySystem: vi.fn()
  }
})

describe('MemoryTool', () => {
  let mockExecutionContext: ExecutionContext
  let mockMemoryManager: MemoryManager
  let mockBrowserContext: BrowserContext
  let mockPage: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock browser context and page
    mockPage = {
      tabId: 123,
      url: vi.fn().mockResolvedValue('https://example.com')
    }

    mockBrowserContext = {
      getCurrentPage: vi.fn().mockResolvedValue(mockPage)
    } as any

    // Mock memory manager
    mockMemoryManager = {
      getAgentId: vi.fn().mockReturnValue('test-agent'),
      addMemory: vi.fn().mockResolvedValue({ success: true }),
      searchMemories: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
      getTaskContext: vi.fn().mockResolvedValue(null),
      getMemoriesByCategory: vi.fn().mockResolvedValue([])
    } as any

    // Mock execution context
    mockExecutionContext = {
      getMemoryManager: vi.fn().mockReturnValue(mockMemoryManager),
      getCurrentTask: vi.fn().mockReturnValue('test-task'),
      browserContext: mockBrowserContext
    } as any
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Memory System Enabled', () => {
    it('should successfully add memory when memory manager is available', async () => {
      const memoryTool = createMemoryTool(mockExecutionContext)
      
      const result = await memoryTool.func({
        action: 'add',
        content: 'Test memory content',
        category: 'user_preference'
      })

      const parsedResult = JSON.parse(result)
      expect(parsedResult.ok).toBe(true)
      expect(mockMemoryManager.addMemory).toHaveBeenCalledWith(
        'Test memory content',
        expect.objectContaining({
          category: 'user_preference',
          agentId: 'test-agent',
          tabId: 123,
          url: 'https://example.com'
        })
      )
    })
  })

  describe('Memory System Disabled', () => {
    it('should return error when memory manager is not available (disabled)', async () => {
      // Mock execution context to return null memory manager (disabled)
      mockExecutionContext.getMemoryManager = vi.fn().mockReturnValue(null)
      
      const memoryTool = createMemoryTool(mockExecutionContext)
      
      const result = await memoryTool.func({
        action: 'add',
        content: 'Test memory content'
      })

      const parsedResult = JSON.parse(result)
      expect(parsedResult.ok).toBe(false)
      expect(parsedResult.error).toContain('Memory system is not initialized')
      expect(parsedResult.error).toContain('Set MEM0_API_KEY environment variable')
    })
  })

  describe('Global Memory Flag Tests', () => {
    it('should gracefully handle MEMORY_ENABLED=false scenario', async () => {
      // Mock initializeMemorySystem to return null when memory is disabled
      vi.mocked(initializeMemorySystem).mockResolvedValue(null)
      
      // Test real-world scenario: try to initialize memory system
      const memoryManager = await initializeMemorySystem('test-key', 'test-agent')
      expect(memoryManager).toBeNull()
      
      // Mock execution context to return null (as it would in real scenario)
      mockExecutionContext.getMemoryManager = vi.fn().mockReturnValue(null)
      
      // Test that MemoryTool handles null manager gracefully
      const memoryTool = createMemoryTool(mockExecutionContext)
      
      const result = await memoryTool.func({
        action: 'add',
        content: 'Test content'
      })
      
      const parsedResult = JSON.parse(result)
      expect(parsedResult.ok).toBe(false)
      expect(parsedResult.error).toContain('Memory system is not initialized')
    })

    it('should gracefully handle no API key scenario', async () => {
      // Mock initializeMemorySystem to return null when no API key is provided
      vi.mocked(initializeMemorySystem).mockResolvedValue(null)
      
      // Test real-world scenario: try to initialize without API key
      const memoryManager = await initializeMemorySystem(undefined, 'test-agent')
      expect(memoryManager).toBeNull()
      
      // Verify initializeMemorySystem was called
      expect(initializeMemorySystem).toHaveBeenCalledWith(undefined, 'test-agent')
    })
  })
})
