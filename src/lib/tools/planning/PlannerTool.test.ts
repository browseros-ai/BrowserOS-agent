import { describe, it, expect, vi } from 'vitest'
import { createPlannerTool } from './PlannerTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { PubSub } from '@/lib/pubsub'

describe('PlannerTool', () => {
  it('tests that planner tool can be created with required dependencies', () => {
    // Setup minimal execution context
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
    
    const tool = createPlannerTool(executionContext)
    
    expect(tool).toBeDefined()
    expect(tool.name).toBe('planner_tool')
    expect(tool.description).toBeDefined()
    expect(typeof tool.func).toBe('function')
  })

  it('tests that errors are handled gracefully and raw error is returned', async () => {
    // Create execution context with failing LLM
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
    
    // Override getLLM to throw error
    executionContext.getLLM = vi.fn().mockRejectedValue(new Error('invalid x-api-key'))
    
    const tool = createPlannerTool(executionContext)
    const result = await tool.func({ task: 'Test task', max_steps: 3 })
    const parsedResult = JSON.parse(result)
    
    expect(parsedResult.ok).toBe(false)
    // Now we expect the raw error message, not prefixed
    expect(parsedResult.output).toBe('invalid x-api-key')
  })

})
