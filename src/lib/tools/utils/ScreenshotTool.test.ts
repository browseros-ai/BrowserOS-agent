import { describe, it, expect, vi } from 'vitest'
import { createScreenshotTool } from './ScreenshotTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { EventBus } from '@/lib/events/EventBus'
import { ToolManager } from '@/lib/tools/ToolManager'

describe('ScreenshotTool-unit-test', () => {
  // Test 1: Tool creation
  it('tests that the tool can be created with required dependencies', () => {
    // Setup minimal dependencies
    const browserContext = new BrowserContext()
    const messageManager = new MessageManager()
    const eventBus = new EventBus()
    const toolManager = new ToolManager()
    const abortController = new AbortController()
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      eventBus,
      toolManager,
      abortController
    })

    const tool = createScreenshotTool(executionContext)

    // Verify tool is created properly
    expect(tool).toBeDefined()
    expect(tool.name).toBe('screenshot')
    expect(tool.description).toContain('Capture a screenshot')
    expect(typeof tool.func).toBe('function')
  })

  // Test 2: Successful screenshot capture
  it('tests that screenshot capture methods are called correctly', async () => {
    // Setup dependencies with mock page
    const mockPage = {
      takeScreenshot: vi.fn().mockResolvedValue('base64imagedata123')
    } as any

    const browserContext = new BrowserContext()
    browserContext.getCurrentPage = vi.fn().mockResolvedValue(mockPage)

    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      eventBus: new EventBus(),
      toolManager: new ToolManager(),
      abortController: new AbortController()
    })

    const tool = createScreenshotTool(executionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method calls
    expect(browserContext.getCurrentPage).toHaveBeenCalled()
    expect(mockPage.takeScreenshot).toHaveBeenCalled()

    // Verify result structure
    const parsed = JSON.parse(result)
    expect(parsed.ok).toBe(true)
    expect(parsed.output).toContain('Screenshot captured successfully')
    expect(parsed.output).toContain('base64imagedata123')
  })

  // Test 3: Error handling when no page is available
  it('tests that error is handled when no active page is found', async () => {
    // Setup dependencies with no page
    const browserContext = new BrowserContext()
    browserContext.getCurrentPage = vi.fn().mockResolvedValue(null)

    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      eventBus: new EventBus(),
      toolManager: new ToolManager(),
      abortController: new AbortController()
    })

    const tool = createScreenshotTool(executionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method was called
    expect(browserContext.getCurrentPage).toHaveBeenCalled()

    // Verify error result
    const parsed = JSON.parse(result)
    expect(parsed.ok).toBe(false)
    expect(parsed.output).toContain('No active page found')
  })

  // Test 4: Error handling when screenshot returns null
  it('tests that error is handled when screenshot capture returns null', async () => {
    // Setup dependencies with page that returns null screenshot
    const mockPage = {
      takeScreenshot: vi.fn().mockResolvedValue(null)
    } as any

    const browserContext = new BrowserContext()
    browserContext.getCurrentPage = vi.fn().mockResolvedValue(mockPage)

    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      eventBus: new EventBus(),
      toolManager: new ToolManager(),
      abortController: new AbortController()
    })

    const tool = createScreenshotTool(executionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method calls
    expect(browserContext.getCurrentPage).toHaveBeenCalled()
    expect(mockPage.takeScreenshot).toHaveBeenCalled()

    // Verify error result
    const parsed = JSON.parse(result)
    expect(parsed.ok).toBe(false)
    expect(parsed.output).toContain('Failed to capture screenshot - no data returned')
  })

  // Test 5: Exception handling during screenshot capture
  it('tests that exceptions during screenshot capture are handled gracefully', async () => {
    // Setup dependencies with page that throws an error
    const mockError = new Error('Screenshot API failed')
    const mockPage = {
      takeScreenshot: vi.fn().mockRejectedValue(mockError)
    } as any

    const browserContext = new BrowserContext()
    browserContext.getCurrentPage = vi.fn().mockResolvedValue(mockPage)

    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      eventBus: new EventBus(),
      toolManager: new ToolManager(),
      abortController: new AbortController()
    })

    const tool = createScreenshotTool(executionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method calls
    expect(browserContext.getCurrentPage).toHaveBeenCalled()
    expect(mockPage.takeScreenshot).toHaveBeenCalled()

    // Verify error result
    const parsed = JSON.parse(result)
    expect(parsed.ok).toBe(false)
    expect(parsed.output).toContain('Failed to capture screenshot: Screenshot API failed')
  })
})