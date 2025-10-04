import { describe, it, expect, vi } from 'vitest'
import { GetSelectedTabsToolImpl, GetSelectedTabsTool } from './GetSelectedTabsTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus, EventProcessor } from '@/lib/events'
import { BrowserPage } from '@/lib/browser/BrowserPage'

describe('GetSelectedTabsTool-unit-test', () => {
  // Unit Test 1: Creation and initialization
  it('tests that the tool can be created with required dependencies', () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const abortController = new AbortController()
    const eventBus = new EventBus()
    const eventProcessor = new EventProcessor(eventBus)
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController,
      debugMode: false,
      eventBus,
      eventProcessor
    })
    
    const tool = new GetSelectedTabsToolImpl(executionContext)
    
    // Verify the tool is created properly
    expect(tool).toBeDefined()
    expect(tool['executionContext']).toBe(executionContext)
    expect(typeof tool.execute).toBe('function')
    
    // Also test the factory function
    const langchainTool = GetSelectedTabsTool(executionContext)
    expect(langchainTool).toBeDefined()
    expect(langchainTool.name).toBe('get_selected_tabs')
    expect(langchainTool.description).toContain('Get information about currently selected tabs')
  })

  // Unit Test 2: Error handling
  it('tests that errors from browser context are handled gracefully', async () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const abortController = new AbortController()
    const eventBus = new EventBus()
    const eventProcessor = new EventProcessor(eventBus)
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController,
      debugMode: false,
      eventBus,
      eventProcessor
    })
    
    // Mock getPages to throw error
    vi.spyOn(browserContext, 'getPages').mockRejectedValue(new Error('Browser connection lost'))
    
    const tool = new GetSelectedTabsToolImpl(executionContext)
    const result = await tool.execute({})
    
    // Verify error is handled
    expect(result.ok).toBe(false)
    expect(result.output).toContain('Failed to get tab information')
    expect(result.output).toContain('Browser connection lost')
  })

  // Unit Test 3: Selected tabs vs current tab logic
  it('tests that selected tabs are used when available, otherwise falls back to current tab', async () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const abortController = new AbortController()
    const eventBus = new EventBus()
    const eventProcessor = new EventProcessor(eventBus)
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController,
      debugMode: false,
      eventBus,
      eventProcessor
    })
    
    // Mock browser pages
    const mockPage1 = {
      tabId: 1,
      url: () => 'https://google.com',
      title: vi.fn().mockResolvedValue('Google')
    } as unknown as BrowserPage
    
    const mockPage2 = {
      tabId: 2,
      url: () => 'https://github.com',
      title: vi.fn().mockResolvedValue('GitHub')
    } as unknown as BrowserPage
    
    const mockPage3 = {
      tabId: 3,
      url: () => 'https://stackoverflow.com',
      title: vi.fn().mockResolvedValue('Stack Overflow')
    } as unknown as BrowserPage
    
    const getPagesSpy = vi.spyOn(browserContext, 'getPages')
    
    const tool = new GetSelectedTabsToolImpl(executionContext)
    
    // Test 1: With selected tabs
    vi.spyOn(executionContext, 'getSelectedTabIds').mockReturnValue([1, 2])
    getPagesSpy.mockResolvedValue([mockPage1, mockPage2])
    
    const result1 = await tool.execute({})
    expect(result1.ok).toBe(true)
    const tabs1 = JSON.parse(result1.output)
    expect(tabs1).toHaveLength(2)
    expect(tabs1[0]).toEqual({ id: 1, url: 'https://google.com', title: 'Google' })
    expect(tabs1[1]).toEqual({ id: 2, url: 'https://github.com', title: 'GitHub' })
    expect(getPagesSpy).toHaveBeenCalledWith([1, 2])
    
    // Test 2: Without selected tabs (should use current tab)
    vi.spyOn(executionContext, 'getSelectedTabIds').mockReturnValue([])
    getPagesSpy.mockResolvedValue([mockPage3])
    
    const result2 = await tool.execute({})
    expect(result2.ok).toBe(true)
    const tabs2 = JSON.parse(result2.output)
    expect(tabs2).toHaveLength(1)
    expect(tabs2[0]).toEqual({ id: 3, url: 'https://stackoverflow.com', title: 'Stack Overflow' })
    expect(getPagesSpy).toHaveBeenCalledWith(undefined)
    
    // Test 3: No pages available
    getPagesSpy.mockResolvedValue([])
    
    const result3 = await tool.execute({})
    expect(result3.ok).toBe(true)
    expect(result3.output).toBe('[]')
  })
})