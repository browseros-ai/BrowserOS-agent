import { describe, it, expect, vi } from 'vitest'
import { ScrollTool } from './ScrollTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus, EventProcessor } from '@/lib/events'

describe('ScrollTool', () => {
  // Unit Test 1: Tool creation
  it('tests that scroll tool can be created', () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new ScrollTool(executionContext)
    expect(tool).toBeDefined()
  })

  // Unit Test 2: Input validation
  it('tests that scroll_to_element validates index requirement', async () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new ScrollTool(executionContext)
    const result = await tool.execute({
      operationType: 'scroll_to_element'
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toBe('scroll_to_element operation requires index parameter')
  })

  // Unit Test 3: Scroll operations
  it('tests that scroll operations execute correctly', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock page with scroll methods
    const mockPage = {
      scrollDown: vi.fn().mockResolvedValue(undefined),
      scrollUp: vi.fn().mockResolvedValue(undefined),
      getElementByIndex: vi.fn().mockResolvedValue({ nodeId: 42, tag: 'button', text: 'Submit' }),
      scrollToElement: vi.fn().mockResolvedValue(true)
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
    
    const tool = new ScrollTool(executionContext)
    
    // Test scroll down (default 1 viewport)
    let result = await tool.execute({ operationType: 'scroll_down' })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollDown).toHaveBeenCalledWith(1)
    
    // Test scroll up (default 1 viewport)
    result = await tool.execute({ operationType: 'scroll_up' })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollUp).toHaveBeenCalledWith(1)
    
    // Test scroll to element
    result = await tool.execute({ operationType: 'scroll_to_element', index: 42 })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollToElement).toHaveBeenCalledWith(42)
  })

  // Unit Test 5: Multi-viewport scrolling via times
  it('tests that times parameter triggers repeated scrolls', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })

    const mockPage = {
      scrollDown: vi.fn().mockResolvedValue(undefined),
      scrollUp: vi.fn().mockResolvedValue(undefined),
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)

    const tool = new ScrollTool(executionContext)

    // Scroll down 3 times
    let result = await tool.execute({ operationType: 'scroll_down', times: 3 })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollDown).toHaveBeenCalledTimes(3)
    expect(mockPage.scrollDown).toHaveBeenNthCalledWith(1, 1)
    expect(mockPage.scrollDown).toHaveBeenNthCalledWith(2, 1)
    expect(mockPage.scrollDown).toHaveBeenNthCalledWith(3, 1)

    // Scroll up 2 times
    result = await tool.execute({ operationType: 'scroll_up', times: 2 })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollUp).toHaveBeenCalledTimes(2)
    expect(mockPage.scrollUp).toHaveBeenNthCalledWith(1, 1)
    expect(mockPage.scrollUp).toHaveBeenNthCalledWith(2, 1)
  })

  // Unit Test 4: Handle element not found
  it('tests that element not found is handled for scroll_to_element', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock page with no element
    const mockPage = {
      getElementByIndex: vi.fn().mockResolvedValue(null)
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
    
    const tool = new ScrollTool(executionContext)
    const result = await tool.execute({
      operationType: 'scroll_to_element',
      index: 999
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toBe('Element with index 999 not found')
  })
})
