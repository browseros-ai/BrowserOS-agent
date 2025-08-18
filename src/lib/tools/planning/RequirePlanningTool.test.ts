import { describe, it, expect, vi } from 'vitest'
import { createRequirePlanningTool } from './RequirePlanningTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'

describe('RequirePlanningTool', () => {
  it('tests that the tool can be created with required dependencies', () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      debugMode: false
    })
    
    const tool = createRequirePlanningTool(executionContext)
    expect(tool).toBeDefined()
    expect(tool.name).toBe('require_planning_tool')
  })

  it('tests that the tool returns success with reason', async () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      debugMode: false
    })
    
    const tool = createRequirePlanningTool(executionContext)
    const result = await tool.func({ reason: 'Current TODOs complete, need next steps' })
    const parsedResult = JSON.parse(result)
    
    expect(parsedResult.ok).toBe(true)
    expect(parsedResult.output).toContain('Re-planning requested')
    expect(parsedResult.output).toContain('Current TODOs complete')
    expect(parsedResult.requiresPlanning).toBe(true)
  })

  it('tests that the tool publishes message to pubsub', async () => {
    const messageManager = new MessageManager()
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager,
      debugMode: false
    })
    
    // Spy on publishMessage
    const publishSpy = vi.spyOn(executionContext.getPubSub(), 'publishMessage')
    
    const tool = createRequirePlanningTool(executionContext)
    await tool.func({ reason: 'Stuck on current task' })
    
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Re-planning requested: Stuck on current task',
        role: 'thinking'
      })
    )
  })
})