import { describe, it, expect, vi } from 'vitest'
import { GroupTabsTool, GroupTabsInputSchema } from './GroupTabsTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus, EventProcessor } from '@/lib/events'

// Mock chrome API
global.chrome = {
  tabs: {
    getCurrent: vi.fn(),
    query: vi.fn(),
    group: vi.fn()
  },
  tabGroups: {
    update: vi.fn()
  }
} as any

describe('GroupTabsTool', () => {
  // Unit Test 1: Tool creation
  it('tests that group tabs tool can be created', () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new GroupTabsTool(executionContext)
    expect(tool).toBeDefined()
  })

  // Unit Test 2: Schema validation  
  it('tests that schema validates minimum array length', () => {
    // Test schema validation directly
    const result = GroupTabsInputSchema.safeParse({ tabIds: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Array must contain at least 1')
    }
  })

  // Unit Test 3: Successful grouping
  it('tests that tabs are grouped successfully', async () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock chrome API responses
    vi.mocked(chrome.tabs.getCurrent).mockResolvedValue({ windowId: 1 } as any)
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 100, windowId: 1 },
      { id: 101, windowId: 1 },
      { id: 102, windowId: 1 }
    ] as any)
    vi.mocked(chrome.tabs.group).mockResolvedValue(999)
    
    const tool = new GroupTabsTool(executionContext)
    const result = await tool.execute({
      tabIds: [100, 101],
      groupName: "My Group",
      color: "blue"
    })
    
    expect(result.ok).toBe(true)
    expect(result.output).toBe('Grouped 2 tabs as "My Group"')
    expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [100, 101] })
    expect(chrome.tabGroups.update).toHaveBeenCalledWith(999, { color: "blue", title: "My Group" })
  })

  // Unit Test 4: Handle invalid tab IDs
  it('tests that invalid tab IDs are handled', async () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock chrome API - no tabs with requested IDs
    vi.mocked(chrome.tabs.getCurrent).mockResolvedValue({ windowId: 1 } as any)
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 200, windowId: 1 },
      { id: 201, windowId: 1 }
    ] as any)
    
    const tool = new GroupTabsTool(executionContext)
    const result = await tool.execute({
      tabIds: [999, 998]  // Non-existent tab IDs
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toBe('No valid tabs found with IDs: 999, 998')
  })
})