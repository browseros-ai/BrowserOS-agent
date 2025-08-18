import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { refreshStateToolDescription } from './RefreshStateTool.prompt';

/**
 * Creates a RefreshStateTool that provides FULL, COMPLEX browser state.
 * This is an EMERGENCY tool for when the agent is completely stuck.
 * 
 * Unlike other tools that get simplified state, this provides exhaustive DOM details
 * to help diagnose why automation is failing.
 * 
 * @param executionContext - The execution context containing browser state
 * @returns A configured RefreshStateTool
 */
export function createRefreshStateTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'refresh_browser_state_tool',
    description: refreshStateToolDescription,
    schema: z.object({}),  // No parameters needed
    func: async () => {
      try {
        // Get COMPLEX state (false = not simplified, include everything)
        const complexBrowserState = await executionContext.browserContext.getBrowserStateString(false);
        
        return JSON.stringify({
          ok: true,
          output: complexBrowserState
        });
      } catch (error) {
        return JSON.stringify({
          ok: false,
          error: `Failed to get complex browser state: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  });
}