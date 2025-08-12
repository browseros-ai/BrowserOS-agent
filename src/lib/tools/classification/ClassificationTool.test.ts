import { describe, it, expect, vi } from 'vitest'
import { ClassificationTool, createClassificationTool } from './ClassificationTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'

describe('ClassificationTool', () => {
  it('tests that classification tool can be created with proper tool descriptions', () => {
    // Setup
    const mockExecutionContext = {
      getLLM: vi.fn(),
      messageManager: new MessageManager()
    } as any

    const toolDescriptions = 'navigation_tool: Navigate browser'

    // Create tool
    const tool = new ClassificationTool(mockExecutionContext, toolDescriptions)

    // Verify it exists
    expect(tool).toBeDefined()
  })

  it('tests that JSON parsing errors from LLM response are handled', async () => {
    // Setup
    const mockLLM = {
      invoke: vi.fn().mockResolvedValue({
        content: 'This is not JSON'  // Invalid response
      })
    }

    const mockExecutionContext = {
      getLLM: vi.fn().mockResolvedValue(mockLLM),
      messageManager: new MessageManager()
    } as any

    const tool = new ClassificationTool(mockExecutionContext, 'some tools')

    // Execute
    const result = await tool.execute({ task: 'any task' })
    const parsed = JSON.parse(result)

    // Verify error handling
    expect(parsed.ok).toBe(false)
    expect(parsed.output).toContain('Classification failed')
  })

  it('tests that factory function creates tool properly', () => {
    // Setup
    const mockExecutionContext = {} as any
    const toolDescriptions = 'test tools'

    // Create tool using factory
    const tool = createClassificationTool(mockExecutionContext, toolDescriptions)

    // Verify tool properties
    expect(tool.name).toBe('classification_tool')
    expect(tool.description).toBe('Classify whether a task is simple/complex and new/follow-up')
  })
})