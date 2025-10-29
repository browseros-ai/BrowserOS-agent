import { describe, it, expect, vi } from 'vitest';
import { EvalsScorer } from './EvalScorer';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

describe('SimplifiedScorer with Gemini', () => {
  it('tests that the scorer can be created', () => {
    const scorer = new EvalsScorer();
    expect(scorer).toBeDefined();
  });
  
  it('tests that scores are in 1-10 range', async () => {
    const scorer = new EvalsScorer();
    // Use heuristic scoring for testing without API key
    scorer['llm'] = null;
    const score = await scorer.scoreFromMessages([], 'test query');
    expect(score.goalCompletion).toBeGreaterThanOrEqual(1);
    expect(score.goalCompletion).toBeLessThanOrEqual(10);
    expect(score.planCorrectness).toBeGreaterThanOrEqual(1);
    expect(score.planCorrectness).toBeLessThanOrEqual(10);
    expect(score.errorFreeExecution).toBeGreaterThanOrEqual(1);
    expect(score.errorFreeExecution).toBeLessThanOrEqual(10);
    expect(score.contextEfficiency).toBeGreaterThanOrEqual(1);
    expect(score.contextEfficiency).toBeLessThanOrEqual(10);
    expect(score.weightedTotal).toBeGreaterThanOrEqual(1);
    expect(score.weightedTotal).toBeLessThanOrEqual(10);
  });
  
  it('tests that tool calls are extracted correctly', async () => {
    const messages = [
      new HumanMessage('test'),
      new AIMessage({
        content: '',
        tool_calls: [{
          id: 'call_1',
          name: 'test_tool',
          args: { input: 'test' }
        }]
      }),
      new ToolMessage({
        content: JSON.stringify({ ok: true, output: 'result' }),
        tool_call_id: 'call_1'
      })
    ];
    
    const scorer = new EvalsScorer();
    // Use heuristic scoring for testing without API key
    scorer['llm'] = null;
    const score = await scorer.scoreFromMessages(messages, 'test');
    expect(score.details.toolCalls).toBe(1);
    expect(score.details.failedCalls).toBe(0);
  });
  
  it('tests that time efficiency scoring works', async () => {
    const scorer = new EvalsScorer();
    // Use heuristic scoring for testing without API key
    scorer['llm'] = null;
    
    const toolMetrics = new Map([
      ['call_1', { toolName: 'test', duration: 30000, success: true, timestamp: Date.now() }],
      ['call_2', { toolName: 'test2', duration: 15000, success: true, timestamp: Date.now() }]
    ]);
    
    const messages = [
      new AIMessage({
        content: '',
        tool_calls: [{
          id: 'call_1',
          name: 'test',
          args: {}
        }, {
          id: 'call_2',
          name: 'test2',
          args: {}
        }]
      })
    ];
    
    const score = await scorer.scoreFromMessages(messages, 'test', toolMetrics);
    expect(score.details.totalDurationMs).toBe(45000); // 45 seconds total
    // Should get high efficiency score (8-9) for < 1 minute
  });
  
  it('tests that heuristic fallback works', async () => {
    // Test without LLM available
    const scorer = new EvalsScorer();
    // Mock getLLM to return null
    scorer['llm'] = null;
    
    const messages = [
      new HumanMessage('test'),
      new AIMessage({
        content: '',
        tool_calls: [{
          id: 'call_1',
          name: 'done_tool',
          args: {}
        }]
      })
    ];
    
    const score = await scorer.scoreFromMessages(messages, 'test query');
    
    expect(score.details.reasoning).toContain('Heuristic');
    expect(score.goalCompletion).toBeGreaterThanOrEqual(1);
    expect(score.goalCompletion).toBeLessThanOrEqual(10);
  });
});