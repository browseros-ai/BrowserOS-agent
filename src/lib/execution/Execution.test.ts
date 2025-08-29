import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Execution } from './Execution'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'

// Mock dependencies
vi.mock('@/lib/browser/BrowserContext')
vi.mock('@/lib/runtime/MessageManager')
vi.mock('@/lib/agent/BrowserAgent')
vi.mock('@/lib/agent/ChatAgent')
vi.mock('@/lib/llm/LangChainProvider', () => ({
  langChainProvider: {
    getModelCapabilities: vi.fn().mockResolvedValue({ maxTokens: 4000 })
  }
}))

describe('Execution - Simplified Design', () => {
  let execution: Execution
  let mockPubSub: PubSubChannel

  beforeEach(() => {
    mockPubSub = {
      publishMessage: vi.fn(),
      clearBuffer: vi.fn()
    } as any

    execution = new Execution({
      executionId: 'test-exec',
      mode: 'browse'
    }, mockPubSub)
  })

  it('tests that execution can be created', () => {
    expect(execution).toBeDefined()
    expect(execution.id).toBe('test-exec')
    expect(execution.isRunning()).toBe(false)
  })

  it('tests that cancel works without previous run', () => {
    // Should not throw when no execution is running
    expect(() => execution.cancel()).not.toThrow()
    expect(execution.isRunning()).toBe(false)
  })

  it('tests that reset clears message history', async () => {
    // Initialize by running once
    try {
      await execution.run('test query')
    } catch {
      // Expected to fail due to mocks
    }

    // Reset should clear message manager
    execution.reset()
    
    // Verify pubsub buffer was cleared
    expect(mockPubSub.clearBuffer).toHaveBeenCalled()
  })

  it('tests that multiple runs work with fresh abort controller', async () => {
    // First run
    const run1 = execution.run('query 1')
    expect(execution.isRunning()).toBe(true)
    
    // Cancel it
    execution.cancel()
    expect(execution.isRunning()).toBe(false)
    
    // Start second run - should work with fresh abort controller
    const run2 = execution.run('query 2')
    expect(execution.isRunning()).toBe(true)
    
    // Cancel again
    execution.cancel()
    expect(execution.isRunning()).toBe(false)
    
    // Third run should also work
    const run3 = execution.run('query 3')
    expect(execution.isRunning()).toBe(true)
  })

  it('tests that concurrent runs cancel previous execution', async () => {
    // Start first run
    const run1 = execution.run('query 1')
    expect(execution.isRunning()).toBe(true)
    
    // Start second run while first is running
    const run2 = execution.run('query 2')
    expect(execution.isRunning()).toBe(true)
    
    // The execution should still be running (with the second query)
    expect(execution.isRunning()).toBe(true)
  })
})