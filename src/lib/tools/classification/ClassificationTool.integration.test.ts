import { describe, it, expect } from 'vitest'
import { ClassificationTool } from './ClassificationTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus } from '@/lib/events'

/**
 * Simple integration test for ClassificationTool
 */
describe('ClassificationTool Integration Test', () => {
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'should classify tasks correctly with real LLM',
    async () => {
      // Setup
      const messageManager = new MessageManager()
      const browserContext = new BrowserContext()
      
      const eventBus = new EventBus()
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        debugMode: false,
        eventBus
      })
      
      const toolDescriptions = 'Available tools: tab operations, bookmarks, history, browser navigation'
      const classificationTool = new ClassificationTool(executionContext, toolDescriptions)
      
      // Test complex task
      const complexResult = await classificationTool.execute({
        task: 'go to amazon and order toothpaste'
      })
      const complexParsed = JSON.parse(complexResult)
      expect(complexParsed.ok).toBe(true)
      const complexData = JSON.parse(complexParsed.output)
      expect(complexData.is_simple_task).toBe(false)
      
      // Test simple task
      const simpleResult = await classificationTool.execute({
        task: 'list tabs'
      })
      const simpleParsed = JSON.parse(simpleResult)
      expect(simpleParsed.ok).toBe(true)
      const simpleData = JSON.parse(simpleParsed.output)
      expect(simpleData.is_simple_task).toBe(true)
      
      console.log('✅ Test passed - ClassificationTool is working with real LLM')
    },
    30000
  )
})
