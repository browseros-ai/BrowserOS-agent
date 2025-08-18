import { describe, it, expect, vi } from 'vitest';
import { createDoneTool } from './DoneTool';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

describe('DoneTool', () => {
  // Create a mock ExecutionContext for testing
  const mockExecutionContext = {
    getPubSub: vi.fn().mockReturnValue({
      publishMessage: vi.fn()
    })
  } as unknown as ExecutionContext;

  it('tests that DynamicStructuredTool is created with correct properties', () => {
    // Test that the tool is created with correct name, description, and schema
    const tool = createDoneTool(mockExecutionContext);
    
    expect(tool.name).toBe('done_tool');
    expect(tool.description).toBe('Mark task as complete');
    expect(tool.schema).toBeDefined();
    expect(typeof tool.func).toBe('function');
  });

  it('tests that success result is returned with default summary when no summary provided', async () => {
    // Test default behavior when no summary is provided
    const tool = createDoneTool(mockExecutionContext);
    const result = await tool.func({});
    const parsedResult = JSON.parse(result);
    
    expect(parsedResult.ok).toBe(true);
    expect(parsedResult.output).toBe('Task completed successfully');
  });

  it('tests that success result is returned with custom summary when provided', async () => {
    // Test that custom summary is used when provided
    const tool = createDoneTool(mockExecutionContext);
    const customSummary = 'Successfully logged into the application';
    const result = await tool.func({ summary: customSummary });
    const parsedResult = JSON.parse(result);
    
    expect(parsedResult.ok).toBe(true);
    expect(parsedResult.output).toBe(customSummary);
  });

  it('tests that tool always returns ok:true indicating successful completion', async () => {
    // Test that the tool always indicates successful completion
    // This is by design - DoneTool marks task as complete, not failed
    const tool = createDoneTool(mockExecutionContext);
    
    // Test with various summaries
    const testCases = [
      { summary: undefined },
      { summary: '' },
      { summary: 'Task completed' },
      { summary: 'Found the requested information' }
    ];
    
    for (const testCase of testCases) {
      const result = await tool.func(testCase);
      const parsedResult = JSON.parse(result);
      expect(parsedResult.ok).toBe(true);
    }
  });
});