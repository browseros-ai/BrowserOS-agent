import { describe, it, expect, vi } from 'vitest'
import { BrowserAgent } from './BrowserAgent'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus, EventProcessor } from '@/lib/events'

// ===================================================================
//  Unit Tests
// ===================================================================
describe('BrowserAgent-unit-test', () => {
  // Unit Test 1: Creation and initialization
  it('tests that browser agent can be created with required dependencies', () => {
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
    
    const browserAgent = new BrowserAgent(executionContext)
    
    // Verify the agent is created and has proper initial state
    expect(browserAgent).toBeDefined()
    expect(browserAgent['toolManager']).toBeDefined()
    expect(browserAgent['messageManager']).toBe(messageManager)
    expect(browserAgent['executionContext']).toBe(executionContext)
  })

  // Unit Test 2: Error handling
  it('tests that errors are handled gracefully', async () => {
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
    
    const browserAgent = new BrowserAgent(executionContext)
    
    // Spy on error event emission
    const errorSpy = vi.spyOn(eventProcessor, 'error')
    
    // Make classification fail
    vi.spyOn(browserAgent as any, '_classifyTask')
      .mockRejectedValue(new Error('Classification failed'))
    
    // Execute should throw error
    await expect(browserAgent.execute('test task')).rejects.toThrow('Classification failed')
    
    // Verify error was emitted with the wrapped error message
    expect(errorSpy).toHaveBeenCalledWith('Oops! Got a fatal error when executing task: Classification failed', true)
  })
})

// ===================================================================
//  Integration Tests
// ===================================================================
describe('BrowserAgent-integration-test', () => {
  // Integration Test: Simple task flow - "list tabs"
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that appropriate functions are called for a simple task like "list tabs"',
    async () => {
      // Setup with real dependencies
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
      
      const browserAgent = new BrowserAgent(executionContext)
      
      // Spy on private methods to verify flow (not mocking, just observing)
      const simpleStrategySpy = vi.spyOn(browserAgent as any, '_executeSimpleTaskStrategy')
      const complexStrategySpy = vi.spyOn(browserAgent as any, '_executeMultiStepStrategy')
      
      // Start execution (don't await)
      browserAgent.execute('list tabs').catch(error => {
        // Do nothing
      })
      
      // Wait for initial processing
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // High-level verification - verify simple task flow was chosen
      expect(simpleStrategySpy).toHaveBeenCalled()
      expect(complexStrategySpy).not.toHaveBeenCalled()
      expect(messageManager.getMessages().length).toBeGreaterThan(2)  // System + user + AI responses
      
      // Cleanup
      abortController.abort()
    },
    30000
  )

  // Integration Test: Complex task flow - "go to amazon and order toothpaste"
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that appropriate functions are called for a complex task like "go to amazon and order toothpaste"',
    async () => {
      // Setup with real dependencies
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
      
      const browserAgent = new BrowserAgent(executionContext)
      
      // Spy on private methods to verify flow (not mocking, just observing)
      const simpleStrategySpy = vi.spyOn(browserAgent as any, '_executeSimpleTaskStrategy')
      const complexStrategySpy = vi.spyOn(browserAgent as any, '_executeMultiStepStrategy')
      const plannerSpy = vi.spyOn(browserAgent as any, '_createMultiStepPlan')
      
      // Start execution (don't await)
      browserAgent.execute('go to amazon and order toothpaste').catch(error => {
        // Do nothing
      })
      
      // Wait for initial processing
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // High-level verification - verify complex task flow was chosen and planning happened
      expect(complexStrategySpy).toHaveBeenCalled()
      expect(simpleStrategySpy).not.toHaveBeenCalled()
      expect(plannerSpy).toHaveBeenCalled()
      
      // Cleanup
      abortController.abort()
    },
    30000
  )
})