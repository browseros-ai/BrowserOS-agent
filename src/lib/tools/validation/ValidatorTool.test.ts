import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createValidatorTool } from './ValidatorTool'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { jsonParseToolOutput } from '@/lib/utils/utils'

describe('ValidatorTool-unit-test', () => {
  let mockExecutionContext: any
  let mockMessageManager: MessageManager
  let mockBrowserContext: any
  let mockPage: any
  let mockLLM: any

  beforeEach(() => {
    // Create mock instances
    mockMessageManager = new MessageManager()
    // Mock getMaxTokens to return a high value for screenshot tests
    vi.spyOn(mockMessageManager, 'getMaxTokens').mockReturnValue(200000)
    
    // Mock page with screenshot functionality (now returns full data URL)
    mockPage = {
      takeScreenshot: vi.fn().mockResolvedValue('data:image/jpeg;base64,mockScreenshotBase64String')
    }
    
    // Mock browser context methods
    mockBrowserContext = {
      getBrowserStateString: vi.fn().mockResolvedValue(
        'Current URL: https://example.com\nPage title: Example Page\nClickable elements: [1] Submit button'
      ),
      getCurrentPage: vi.fn().mockResolvedValue(mockPage),
      getConfig: vi.fn().mockReturnValue({ useVision: true })
    }
    
    // Mock LLM with structured output
    mockLLM = {
      withStructuredOutput: vi.fn().mockReturnValue({
        invoke: vi.fn().mockResolvedValue({
          isComplete: true,  // Add isComplete field
          reasoning: 'Task completed successfully. The submit button was clicked and confirmation page is displayed.',
          confidence: 'high',
          suggestions: []
        })
      })
    }
    
    // Create mock execution context
    mockExecutionContext = {
      getLLM: vi.fn().mockResolvedValue(mockLLM),
      messageManager: mockMessageManager,
      browserContext: mockBrowserContext,
      getPubSub: vi.fn().mockReturnValue({
        publishMessage: vi.fn()
      }),
      abortController: new AbortController()
    }
    
    // Add some message history
    mockMessageManager.addHuman('Submit the form')
    mockMessageManager.addAI('I will submit the form for you')
  })

  it('tests that the tool can be created with required dependencies', () => {
    const tool = createValidatorTool(mockExecutionContext)
    
    expect(tool).toBeDefined()
    expect(tool.name).toBe('validator_tool')
    expect(tool.description).toBe('Validate if the task has been completed based on current browser state')
  })

  it('tests that the tool handles LLM errors gracefully', async () => {
    // Mock LLM to throw error
    mockLLM.withStructuredOutput.mockReturnValue({
      invoke: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
    })
    
    const tool = createValidatorTool(mockExecutionContext)
    const result = await tool.func({ task: 'Submit the form' })
    const parsedResult = jsonParseToolOutput(result)
    
    expect(parsedResult.ok).toBe(false)
    expect(parsedResult.output).toContain('LLM service unavailable')
  })

  it('tests that the tool returns isComplete field in output', async () => {
    const tool = createValidatorTool(mockExecutionContext)
    const result = await tool.func({ task: 'Submit the form' })
    const parsedResult = jsonParseToolOutput(result)
    
    expect(parsedResult.ok).toBe(true)
    
    const validationData = parsedResult.output
    expect(validationData).toHaveProperty('isComplete')
    expect(validationData.isComplete).toBe(true)  // Based on our mock
    expect(validationData).toHaveProperty('reasoning')
    expect(validationData).toHaveProperty('confidence')
    expect(validationData).toHaveProperty('suggestions')
  })

  it('tests that validation captures screenshot and includes it in prompt', async () => {
    const tool = createValidatorTool(mockExecutionContext)
    
    await tool.func({ task: 'Navigate to checkout page' })
    
    // Verify getCurrentPage was called
    expect(mockBrowserContext.getCurrentPage).toHaveBeenCalled()
    
    // Verify takeScreenshot was called on the page
    expect(mockPage.takeScreenshot).toHaveBeenCalled()
    
    // Verify browser state was retrieved
    expect(mockBrowserContext.getBrowserStateString).toHaveBeenCalled()
    
    // Verify LLM was called with structured output
    expect(mockLLM.withStructuredOutput).toHaveBeenCalled()
    
    // Verify invoke was called with system and human messages
    const invokeCall = mockLLM.withStructuredOutput().invoke
    expect(invokeCall).toHaveBeenCalled()
    
    const messages = invokeCall.mock.calls[0][0]
    expect(messages).toHaveLength(2)
    expect(messages[0]._getType()).toBe('system')
    expect(messages[1]._getType()).toBe('human')
    
    // Verify the human message contains the screenshot in data URL format
    const humanMessage = messages[1]
    const humanMessageContent = humanMessage.content as string
    
    // Check that screenshot was included (now as complete data URL from takeScreenshot)
    expect(humanMessageContent).toContain('data:image/jpeg;base64,mockScreenshotBase64String')
    
    // Check that message history was included (from setup)
    expect(humanMessageContent).toContain('Submit the form')
    expect(humanMessageContent).toContain('I will submit the form for you')
    
    // Also verify it contains the browser state
    expect(humanMessageContent).toContain('https://example.com')
    expect(humanMessageContent).toContain('Example Page')
  })

  it('tests that validation handles screenshot capture errors gracefully', async () => {
    // Mock takeScreenshot to throw an error
    mockPage.takeScreenshot.mockRejectedValue(new Error('Screenshot capture failed'))
    
    const tool = createValidatorTool(mockExecutionContext)
    const result = await tool.func({ task: 'Navigate to checkout page' })
    const parsedResult = jsonParseToolOutput(result)
    
    // Should still succeed even if screenshot fails
    expect(parsedResult.ok).toBe(true)
    
    // Verify getCurrentPage and takeScreenshot were attempted
    expect(mockBrowserContext.getCurrentPage).toHaveBeenCalled()
    expect(mockPage.takeScreenshot).toHaveBeenCalled()
    
    // Verify LLM was still called (validation continues without screenshot)
    expect(mockLLM.withStructuredOutput).toHaveBeenCalled()
    
    const invokeCall = mockLLM.withStructuredOutput().invoke
    expect(invokeCall).toHaveBeenCalled()
    
    // Verify the human message doesn't contain screenshot data URL
    const messages = invokeCall.mock.calls[0][0]
    const humanMessage = messages[1]
    const humanMessageContent = humanMessage.content as string
    
    // Should not contain screenshot data URL when capture fails
    expect(humanMessageContent).not.toContain('data:image/jpeg;base64,')
    
    // But should still contain other data
    expect(humanMessageContent).toContain('https://example.com')
  })

  it('tests that validation handles missing current page gracefully', async () => {
    // Mock getCurrentPage to return null (no active page)
    mockBrowserContext.getCurrentPage.mockReturnValue(null)
    
    const tool = createValidatorTool(mockExecutionContext)
    const result = await tool.func({ task: 'Navigate to checkout page' })
    const parsedResult = jsonParseToolOutput(result)
    
    // Should still succeed even if no current page
    expect(parsedResult.ok).toBe(true)
    
    // Verify getCurrentPage was called
    expect(mockBrowserContext.getCurrentPage).toHaveBeenCalled()
    
    // Verify takeScreenshot was NOT called (no page available)
    expect(mockPage.takeScreenshot).not.toHaveBeenCalled()
    
    // Verify LLM was still called (validation continues without screenshot)
    expect(mockLLM.withStructuredOutput).toHaveBeenCalled()
  })

  it('tests that screenshot is not captured when useVision is false', async () => {
    // Override config to disable vision
    mockBrowserContext.getConfig.mockReturnValue({ useVision: false })
    
    const tool = createValidatorTool(mockExecutionContext)
    
    await tool.func({ task: 'Submit the form' })
    
    // Verify vision config was checked
    expect(mockBrowserContext.getConfig).toHaveBeenCalled()
    
    // Verify page and screenshot were NOT accessed
    expect(mockBrowserContext.getCurrentPage).not.toHaveBeenCalled()
    expect(mockPage.takeScreenshot).not.toHaveBeenCalled()
    
    // Verify the screenshot was NOT included in the prompt
    const invokeCall = mockLLM.withStructuredOutput().invoke
    const messages = invokeCall.mock.calls[0][0]
    const humanMessage = messages[1]
    const humanMessageContent = humanMessage.content as string
    
    // Check that screenshot section was not included
    expect(humanMessageContent).not.toContain('# SCREENSHOT')
    expect(humanMessageContent).not.toContain('data:image/jpeg;base64')
  })
})

describe('ValidatorTool-integration-test', () => {
  const hasApiKey = process.env.LITELLM_API_KEY && process.env.LITELLM_API_KEY !== 'nokey'
  
  it.skipIf(!hasApiKey)(
    'tests that ordering task is not complete when only in cart',
    async () => {
      // Import required modules for integration test
      const { ExecutionContext } = await import('@/lib/runtime/ExecutionContext')
      const { MessageManager } = await import('@/lib/runtime/MessageManager')
      const { BrowserContext } = await import('@/lib/browser/BrowserContext')
      const { PubSub } = await import('@/lib/pubsub')
      
      // Setup
      const messageManager = new MessageManager()
      const browserContext = new BrowserContext()
      const abortController = new AbortController()
      const pubSub = new PubSub()
      
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        pubSub
      })
      
      // Mock page with screenshot capability
      const mockPage = {
        takeScreenshot: vi.fn().mockResolvedValue('realScreenshotBase64Data')
      }
      
      // Mock browser context methods
      const getConfigSpy = vi.spyOn(browserContext, 'getConfig').mockReturnValue({ useVision: true } as any)
      const getCurrentPageSpy = vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
      const getBrowserStateStringSpy = vi.spyOn(browserContext, 'getBrowserStateString').mockResolvedValue(`
Current URL: https://www.amazon.com/gp/cart/view.html
Page title: Amazon.com Shopping Cart

Page content:
Shopping Cart
Your Amazon Cart is not empty

Colgate Total Whitening Toothpaste, 4.8 oz
Price: $4.99
Quantity: 1
Subtotal: $4.99

Cart subtotal (1 item): $4.99

Clickable elements:
[1] Proceed to checkout
[2] Delete item
[3] Save for later
[4] Change quantity
[5] Continue shopping

Typeable elements:
[1] Quantity input field
[2] Gift message textbox
      `)
      
      // Add execution history showing navigation to cart
      messageManager.addHuman('Order toothpaste from Amazon')
      messageManager.addAI('I will help you order toothpaste from Amazon')
      messageManager.addTool(JSON.stringify({
        ok: true,
        output: 'Navigated to Amazon.com'
      }), 'nav_1')
      messageManager.addAI('Searching for toothpaste')
      messageManager.addTool(JSON.stringify({
        ok: true,
        output: 'Searched for "toothpaste" - found Colgate Total Whitening'
      }), 'search_1')
      messageManager.addAI('Adding toothpaste to cart')
      messageManager.addTool(JSON.stringify({
        ok: true,
        output: 'Added Colgate Total Whitening Toothpaste to cart'
      }), 'click_1')
      
      // Create validator tool and test
      const validatorTool = createValidatorTool(executionContext)
      
      const result = await validatorTool.func({
        task: 'Order toothpaste from Amazon'
      })
      
      const parsedResult = jsonParseToolOutput(result)
      expect(parsedResult.ok).toBe(true)
      
      const validationData = parsedResult.output
      
      // Should NOT be complete - item is in cart but not ordered
      expect(validationData.isComplete).toBe(false)
      expect(validationData.suggestions.length).toBeGreaterThan(0)
      
      // Should suggest proceeding to checkout
      const suggestsCheckout = validationData.suggestions.some((s: string) => 
        s.toLowerCase().includes('checkout') || 
        s.toLowerCase().includes('proceed')
      )
      expect(suggestsCheckout).toBe(true)
      
      console.log('✅ Integration test passed - ValidatorTool correctly identifies incomplete order')
      console.log('Validation result:', {
        isComplete: validationData.isComplete,
        reasoning: validationData.reasoning,
        confidence: validationData.confidence,
        suggestions: validationData.suggestions
      })
      
      // Cleanup
      getBrowserStateStringSpy.mockRestore()
      getCurrentPageSpy.mockRestore()
      getConfigSpy.mockRestore()
    },
    30000
  )
})