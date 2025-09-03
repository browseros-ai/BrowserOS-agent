import { describe, it, expect, vi } from 'vitest'
import { createScreenshotTool } from './ScreenshotTool'
import { jsonParseToolOutput } from '@/lib/utils/utils'

describe('ScreenshotTool-unit-test', () => {
  // Test 1: Tool creation
  it('tests that the tool can be created with required dependencies', () => {
    // Setup minimal dependencies
    const mockExecutionContext = {
      browserContext: {
        getCurrentPage: vi.fn()
      },
      messageManager: {
        getMaxTokens: vi.fn().mockReturnValue(128000)
      },
      getPubSub: vi.fn().mockReturnValue({
        publishMessage: vi.fn()
      })
    } as any

    const tool = createScreenshotTool(mockExecutionContext)

    // Verify tool is created properly
    expect(tool).toBeDefined()
    expect(tool.name).toBe('screenshot_tool')
    expect(tool.description).toContain('Capture a screenshot')
    expect(typeof tool.func).toBe('function')
  })

  // Test 2: Successful screenshot capture
  it('tests that screenshot capture methods are called correctly', async () => {
    // Setup dependencies with mock page
    const mockPage = {
      takeScreenshot: vi.fn().mockResolvedValue('data:image/jpeg;base64,base64imagedata123')
    } as any

    const mockExecutionContext = {
      browserContext: {
        getCurrentPage: vi.fn().mockResolvedValue(mockPage)
      },
      messageManager: {
        getMaxTokens: vi.fn().mockReturnValue(128000)
      },
      getPubSub: vi.fn().mockReturnValue({
        publishMessage: vi.fn()
      })
    } as any

    const tool = createScreenshotTool(mockExecutionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method calls
    expect(mockExecutionContext.browserContext.getCurrentPage).toHaveBeenCalled()
    expect(mockPage.takeScreenshot).toHaveBeenCalled()

    // Verify result structure
    const parsed = jsonParseToolOutput(result)
    expect(parsed.ok).toBe(true)
    const outputData = parsed.output
    expect(outputData.message).toBe('Captured screenshot of the page.')
    expect(outputData.screenshot).toBe('data:image/jpeg;base64,base64imagedata123')
  })

  // Test 3: Error handling when no page is available
  it('tests that error is handled when no active page is found', async () => {
    // Setup dependencies with no page
    const mockExecutionContext = {
      browserContext: {
        getCurrentPage: vi.fn().mockResolvedValue(null)
      },
      messageManager: {
        getMaxTokens: vi.fn().mockReturnValue(128000)
      },
      getPubSub: vi.fn().mockReturnValue({
        publishMessage: vi.fn()
      })
    } as any

    const tool = createScreenshotTool(mockExecutionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method was called
    expect(mockExecutionContext.browserContext.getCurrentPage).toHaveBeenCalled()

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

    const mockExecutionContext = {
      browserContext: {
        getCurrentPage: vi.fn().mockResolvedValue(mockPage)
      },
      messageManager: {
        getMaxTokens: vi.fn().mockReturnValue(128000)
      },
      getPubSub: vi.fn().mockReturnValue({
        publishMessage: vi.fn()
      })
    } as any

    const tool = createScreenshotTool(mockExecutionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method calls
    expect(mockExecutionContext.browserContext.getCurrentPage).toHaveBeenCalled()
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

    const mockExecutionContext = {
      browserContext: {
        getCurrentPage: vi.fn().mockResolvedValue(mockPage)
      },
      messageManager: {
        getMaxTokens: vi.fn().mockReturnValue(128000)
      },
      getPubSub: vi.fn().mockReturnValue({
        publishMessage: vi.fn()
      })
    } as any

    const tool = createScreenshotTool(mockExecutionContext)

    // Execute the tool
    const result = await tool.func({})

    // Verify method calls
    expect(mockExecutionContext.browserContext.getCurrentPage).toHaveBeenCalled()
    expect(mockPage.takeScreenshot).toHaveBeenCalled()

    // Verify error result
    const parsed = JSON.parse(result)
    expect(parsed.ok).toBe(false)
    expect(parsed.output).toContain('Screenshot API failed')
  })
})