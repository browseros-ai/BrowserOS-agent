import { describe, it, expect } from 'vitest';
import { SimplifiedScorer } from './SimplifiedScorer';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

describe('SimplifiedScorer', () => {
  it('tests that the scorer can be created', () => {
    const scorer = new SimplifiedScorer();
    expect(scorer).toBeDefined();
  });
  
  it('tests that scoring handles empty messages', async () => {
    const scorer = new SimplifiedScorer();
    const score = await scorer.scoreFromMessages([], 'test query');
    expect(score.weightedTotal).toBeGreaterThanOrEqual(0);
    expect(score.weightedTotal).toBeLessThanOrEqual(1);
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
    
    const scorer = new SimplifiedScorer();
    const score = await scorer.scoreFromMessages(messages, 'test');
    expect(score.details.toolCalls).toBe(1);
    expect(score.details.failedCalls).toBe(0);
  });
});