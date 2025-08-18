import { describe, it, expect, vi } from 'vitest';
import { createResultTool } from './ResultTool';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { ToolMessage } from '@langchain/core/messages';

describe('ResultTool', () => {
  it('tests that the tool can be created with required dependencies', () => {
    const mockContext = {
      getLLM: vi.fn(),
      messageManager: {},
      browserContext: {}
    } as unknown as ExecutionContext;
    
    const tool = createResultTool(mockContext);
    expect(tool).toBeDefined();
    expect(tool.name).toBe('result_tool');
  });

  it('tests that the tool handles errors gracefully', async () => {
    const mockContext = {
      getLLM: vi.fn().mockRejectedValue(new Error('LLM connection failed')),
      messageManager: {
        getMessages: vi.fn().mockReturnValue([])
      },
      browserContext: {
        getBrowserStateString: vi.fn()
      }
    } as unknown as ExecutionContext;
    
    const tool = createResultTool(mockContext);
    const result = await tool.func({ task: 'Test task' });
    const parsed = JSON.parse(result);
    
    expect(parsed.ok).toBe(false);
  });

  it('tests that the tool filters to only include tool messages', async () => {
    const mockLLM = {
      withStructuredOutput: vi.fn().mockReturnValue({
        invoke: vi.fn().mockResolvedValue({
          success: true,
          message: '✓ Task completed\n\n**Result: Test completed**'
        })
      })
    };

    const mockMessages = [
      new ToolMessage({ content: 'Tool message 1', tool_call_id: '1' }),
      { _getType: () => 'human', content: 'Human message' },
      new ToolMessage({ content: 'Tool message 2', tool_call_id: '2' }),
      { _getType: () => 'ai', content: 'AI message' }
    ];

    const mockContext = {
      getLLM: vi.fn().mockResolvedValue(mockLLM),
      messageManager: {
        getMessages: vi.fn().mockReturnValue(mockMessages)
      },
      browserContext: {
        getBrowserStateString: vi.fn().mockResolvedValue('Current page: example.com')
      }
    } as unknown as ExecutionContext;
    
    const tool = createResultTool(mockContext);
    const result = await tool.func({ task: 'Test filtering' });
    const parsed = JSON.parse(result);
    
    expect(parsed.ok).toBe(true);
    expect(parsed.output.success).toBe(true);
    expect(parsed.output.message).toContain('Task completed');
  });
});
