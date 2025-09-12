import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatAgent } from './ChatAgent'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager, MessageType } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { PubSub } from '@/lib/pubsub'

describe('ChatAgent', () => {
  let executionContext: ExecutionContext
  let messageManager: MessageManager
  let browserContext: BrowserContext
  let chatAgent: ChatAgent

  beforeEach(() => {
    // Create mock instances
    messageManager = new MessageManager()
    
    // Mock BrowserContext with getCurrentPage
    browserContext = {
      getCurrentPage: vi.fn().mockResolvedValue({
        tabId: 123,
        url: () => 'https://example.com',
        title: () => 'Example Page'
      })
    } as any
    
    const pubsub = new PubSub()
    
    // Create execution context with mocks
    executionContext = {
      messageManager,
      browserContext,
      getPubSub: () => pubsub,
      getSelectedTabIds: () => [1],
      setSelectedTabIds: vi.fn(),
      getCurrentTask: () => 'test task',
      getLLM: vi.fn(),
      abortController: new AbortController()
    } as any
    
    // Create ChatAgent instance
    chatAgent = new ChatAgent(executionContext)
  })

  it('tests that ChatAgent can be created with required dependencies', () => {
    expect(chatAgent).toBeDefined()
    expect(chatAgent).toBeInstanceOf(ChatAgent)
  })

  it('tests that fresh conversation is detected correctly', () => {
    // Initially message manager is empty
    const isFresh = (chatAgent as any)._isFreshConversation()
    expect(isFresh).toBe(true)
    
    // Add a message
    messageManager.addSystem('test')
    const isNotFresh = (chatAgent as any)._isFreshConversation()
    expect(isNotFresh).toBe(false)
  })

  it('tests that tab changes are detected correctly', () => {
    const chatAgentWithPrivate = chatAgent as any
    
    // First time should return true (no previous tabs)
    const tabIds1 = new Set([1, 2, 3])
    expect(chatAgentWithPrivate._hasTabsChanged(tabIds1)).toBe(true)
    
    // Set the last extracted tabs
    chatAgentWithPrivate.lastExtractedTabIds = new Set([1, 2, 3])
    
    // Same tabs should return false
    const tabIds2 = new Set([1, 2, 3])
    expect(chatAgentWithPrivate._hasTabsChanged(tabIds2)).toBe(false)
    
    // Different tabs should return true
    const tabIds3 = new Set([1, 2, 4])
    expect(chatAgentWithPrivate._hasTabsChanged(tabIds3)).toBe(true)
    
    // Different size should return true
    const tabIds4 = new Set([1, 2])
    expect(chatAgentWithPrivate._hasTabsChanged(tabIds4)).toBe(true)
  })
  
  it('tests that getCurrentTabIds uses correct source based on selection', async () => {
    const chatAgentWithPrivate = chatAgent as any
    
    // Test 1: Multiple tabs selected (explicit selection) - should use ExecutionContext
    let mockTabIds: number[] | null = [5, 6, 7]
    executionContext.getSelectedTabIds = () => mockTabIds
    
    const multiTabIds = await chatAgentWithPrivate._getCurrentTabIds()
    expect(multiTabIds).toEqual(new Set([5, 6, 7]))
    
    // Test 2: Single tab (no explicit selection) - should use BrowserContext
    mockTabIds = [1]  // Only one tab
    executionContext.getSelectedTabIds = () => mockTabIds
    
    const singleTabIds = await chatAgentWithPrivate._getCurrentTabIds()
    expect(singleTabIds).toEqual(new Set([123]))  // Should get tab ID from getCurrentPage mock
    
    // Test 3: No tabs - should use BrowserContext
    mockTabIds = null
    executionContext.getSelectedTabIds = () => mockTabIds
    
    const noTabIds = await chatAgentWithPrivate._getCurrentTabIds()
    expect(noTabIds).toEqual(new Set([123]))  // Should get tab ID from getCurrentPage mock
    
    // Test 4: getCurrentPage fails - should fallback to ExecutionContext
    browserContext.getCurrentPage = vi.fn().mockRejectedValue(new Error('Failed'))
    mockTabIds = [999]
    executionContext.getSelectedTabIds = () => mockTabIds
    
    const fallbackTabIds = await chatAgentWithPrivate._getCurrentTabIds()
    expect(fallbackTabIds).toEqual(new Set([999]))  // Should fallback to ExecutionContext
  })
  
  it('tests that browser state messages are replaced correctly', () => {
    // Add initial browser state
    messageManager.addBrowserState('First page content')
    let messages = messageManager.getMessages()
    expect(messages.some(m => m.content?.includes('<browser-state>First page content</browser-state>'))).toBe(true)
    
    // Replace browser state (addBrowserState automatically replaces)
    messageManager.addBrowserState('Second page content')
    messages = messageManager.getMessages()
    
    // Should only have the new browser state, not both
    expect(messages.some(m => m.content?.includes('<browser-state>Second page content</browser-state>'))).toBe(true)
    expect(messages.some(m => m.content?.includes('First page content'))).toBe(false)
    
    // Should only have one browser state message
    const browserStateCount = messages.filter(m => 
      m.content?.includes('<browser-state>') && m.content?.includes('</browser-state>')
    ).length
    expect(browserStateCount).toBe(1)
  })
})