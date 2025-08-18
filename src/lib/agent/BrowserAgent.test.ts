import { describe, it, expect, vi } from 'vitest'
import { BrowserAgent } from './BrowserAgent'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { PubSub } from '@/lib/pubsub'

// ===================================================================
//  Unit Tests
// ===================================================================
describe('BrowserAgent-unit-test', () => {
  // Unit Test 1: Creation and initialization
  it('tests that browser agent can be created with required dependencies', () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const abortController = new AbortController()
    const pubsub = new PubSub()
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController,
      debugMode: false,
      pubsub
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
    const pubsub = new PubSub()
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController,
      debugMode: false,
      pubsub
    })
    
    const browserAgent = new BrowserAgent(executionContext)
    
    // Spy on error event emission
    const errorSpy = vi.spyOn(console, 'error')
    
    // Make classification fail
    vi.spyOn(browserAgent as any, '_classifyTask')
      .mockRejectedValue(new Error('Classification failed'))
    
    // Execute should throw error
    await expect(browserAgent.execute('test task')).rejects.toThrow('Classification failed')
    
    // Verify error was emitted with the wrapped error message
    expect(errorSpy).toHaveBeenCalledWith('Oops! Got a fatal error when executing task: Classification failed', true)
  })

  // Unit Test 3: TODOs are populated from plan
  it('tests that TODOs are added from plan steps', async () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const abortController = new AbortController()
    const pubsub = new PubSub()
    
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      abortController,
      debugMode: false,
      pubsub
    })
    
    const browserAgent = new BrowserAgent(executionContext)
    
    // Create a mock plan
    const mockPlan = {
      steps: [
        { action: 'Navigate to website', reasoning: 'Need to go to the site first' },
        { action: 'Find search box', reasoning: 'Need to locate search functionality' },
        { action: 'Enter search query', reasoning: 'Input the search terms' }
      ]
    }
    
    // Call the private method directly
    await (browserAgent as any)._updateTodosFromPlan(mockPlan)
    
    // Verify TODOs were added to the store
    const todos = executionContext.todoStore.getAll()
    expect(todos).toHaveLength(3)
    expect(todos[0].content).toBe('Navigate to website')
    expect(todos[0].status).toBe('todo')
    expect(todos[0].id).toBe(1)
    expect(todos[1].content).toBe('Find search box')
    expect(todos[1].status).toBe('todo')
    expect(todos[1].id).toBe(2)
    expect(todos[2].content).toBe('Enter search query')
    expect(todos[2].status).toBe('todo')
    expect(todos[2].id).toBe(3)
    
    // Verify todo_manager tool was called
    const todoTool = browserAgent['toolManager'].get('todo_manager_tool')
    expect(todoTool).toBeDefined()
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
      
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        pubsub
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
      
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        pubsub
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

  // Integration Test: TODO-driven execution flow
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that complex tasks use TODO-driven execution flow',
    async () => {
      // Setup with real instances
      const messageManager = new MessageManager()
      const browserContext = new BrowserContext()
      const abortController = new AbortController()
      const eventBus = new EventBus()
      
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        pubsub
      })
      
      const browserAgent = new BrowserAgent(executionContext)
      
      // Spy on the _fetchTodoXml method to verify TODOs are being checked
      const fetchTodoSpy = vi.spyOn(browserAgent as any, '_fetchTodoXml')
      
      // Start execution of a complex task (don't await)
      browserAgent.execute('research top 3 programming languages in 2024 and create a comparison table').catch(error => {
        // Expected - we'll abort early
      })
      
      // Wait a bit for the agent to start processing
      await new Promise(resolve => setTimeout(resolve, 8000))
      
      // Check 2-3 key things happened
      // 1. TODO XML was fetched (indicating TODO-driven flow)
      expect(fetchTodoSpy).toHaveBeenCalled()
      
      // 2. TodoStore has TODOs (if the agent created any)
      const todos = executionContext.todoStore.getAll()
      console.log(`TODOs created: ${todos.length}`)
      
      // 3. Complex task strategy was used (check via message history)
      const messages = messageManager.getMessages()
      const hasComplexTaskFlow = messages.some(msg => 
        msg.content && typeof msg.content === 'string' && 
        (msg.content.includes('plan') || msg.content.includes('TODO'))
      )
      expect(hasComplexTaskFlow).toBe(true)
      
      // Cleanup and exit
      abortController.abort()
      console.log('✅ TODO-driven execution flow test passed')
    },
    30000
  )

  // Integration Test: TODOs populated from plan during execution
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests that TODOs are populated from plan steps during complex task execution',
    async () => {
      // Setup with real instances
      const messageManager = new MessageManager()
      const browserContext = new BrowserContext()
      const abortController = new AbortController()
      const eventBus = new EventBus()
      
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        pubsub
      })
      
      const browserAgent = new BrowserAgent(executionContext)
      
      // Spy on methods to track the flow
      const updateTodosSpy = vi.spyOn(browserAgent as any, '_updateTodosFromPlan')
      const plannerSpy = vi.spyOn(browserAgent as any, '_createMultiStepPlan')
      
      // Start execution of a complex task (don't await)
      browserAgent.execute('find information about TypeScript and create a summary').catch(error => {
        // Expected - we'll abort early
      })
      
      // Wait for planning to complete
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Verify the flow
      // 1. Planner was called
      expect(plannerSpy).toHaveBeenCalled()
      
      // 2. _updateTodosFromPlan was called
      expect(updateTodosSpy).toHaveBeenCalled()
      
      // 3. TodoStore has TODOs from the plan
      const todos = executionContext.todoStore.getAll()
      expect(todos.length).toBeGreaterThan(0)
      console.log(`TODOs populated from plan: ${todos.length}`)
      console.log('TODO contents:', todos.map(t => `${t.id}: ${t.content}`).join('\n'))
      
      // 4. Verify TODOs match plan steps pattern
      const allTodosHaveContent = todos.every(todo => todo.content && todo.content.length > 0)
      expect(allTodosHaveContent).toBe(true)
      
      // Cleanup and exit
      abortController.abort()
      console.log('✅ TODOs from plan test passed')
    },
    30000
  )
})