import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BraintrustEventManager } from './BraintrustEventManager';
import { EvalsScorer } from './EvalScorer';
import { wrapToolForMetrics } from './EvalToolWrapper';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

describe('Evals2 Integration', () => {
  let eventManager: BraintrustEventManager;
  
  beforeAll(() => {
    // Set env var for testing
    process.env.ENABLE_EVALS2 = 'true';
    eventManager = BraintrustEventManager.getInstance();
  });
  
  afterAll(() => {
    // Clean up
    eventManager.reset();
    delete process.env.ENABLE_EVALS2;
  });
  
  it('tests that the event manager can be initialized', () => {
    expect(eventManager).toBeDefined();
    // Will be false without API key, which is expected in test
    expect(eventManager.isEnabled()).toBeDefined();
  });
  
  it('tests that tool wrapping tracks duration', async () => {
    // Create a mock execution context
    const mockContext = {
      toolMetrics: undefined as any,
      // Add other required properties as needed
    } as any;
    
    // Create a simple tool
    const testTool = new DynamicStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      schema: z.object({
        input: z.string()
      }),
      func: async (input: any) => {
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 50));
        return JSON.stringify({ ok: true, output: 'test result' });
      }
    });
    
    // Wrap the tool
    const wrappedTool = wrapToolForMetrics(testTool, mockContext, 'test_call_123');
    
    // Execute the wrapped tool
    const result = await wrappedTool.func({ input: 'test' });
    
    // Verify metrics were tracked
    expect(mockContext.toolMetrics).toBeDefined();
    expect(mockContext.toolMetrics.size).toBe(1);
    
    const metrics = mockContext.toolMetrics.get('test_call_123');
    expect(metrics).toBeDefined();
    expect(metrics.toolName).toBe('test_tool');
    expect(metrics.duration).toBeGreaterThan(40); // Should be at least 50ms
    expect(metrics.success).toBe(true);
  });
  
  it('tests that scorer can process messages with tool metrics', async () => {
    // Create mock tool metrics
    const toolMetrics = new Map();
    toolMetrics.set('call_1', {
      toolName: 'navigation_tool',
      duration: 123,
      success: true,
      timestamp: Date.now()
    });
    
    // Create test messages
    const messages = [
      new HumanMessage('Navigate to example.com'),
      new AIMessage({
        content: '',
        tool_calls: [{
          id: 'call_1',
          name: 'navigation_tool',
          args: { url: 'https://example.com' }
        }]
      }),
      new ToolMessage({
        content: JSON.stringify({ ok: true, output: 'Navigated successfully' }),
        tool_call_id: 'call_1'
      }),
      new AIMessage({
        content: '',
        tool_calls: [{
          id: 'call_2',
          name: 'done_tool',
          args: {}
        }]
      }),
      new ToolMessage({
        content: JSON.stringify({ ok: true }),
        tool_call_id: 'call_2'
      })
    ];
    
    const scorer = new EvalsScorer();
    
    // Test 1: Without API key, it should throw
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      await expect(scorer.scoreFromMessages(messages, 'Navigate to example.com', toolMetrics))
        .rejects.toThrow('Gemini API key is required');
    } else {
      // Test 2: With API key, it should work
      const score = await scorer.scoreFromMessages(messages, 'Navigate to example.com', toolMetrics);
      expect(score).toBeDefined();
      expect(score.weightedTotal).toBeGreaterThanOrEqual(1);
      expect(score.weightedTotal).toBeLessThanOrEqual(10);
      expect(score.details.toolCalls).toBe(2); // navigation_tool and done_tool
      expect(score.details.failedCalls).toBe(0);
    }
    
    // Test 3: With llm set to null, should use heuristics
    scorer['llm'] = null;
    const heuristicScore = await scorer.scoreFromMessages(messages, 'Navigate to example.com', toolMetrics);
    expect(heuristicScore).toBeDefined();
    expect(heuristicScore.weightedTotal).toBeGreaterThanOrEqual(1);
    expect(heuristicScore.weightedTotal).toBeLessThanOrEqual(10);
    expect(heuristicScore.details.reasoning).toContain('Heuristic');
  });
});