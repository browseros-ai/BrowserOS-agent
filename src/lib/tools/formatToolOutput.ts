/**
 * Lightweight tool output formatter that converts raw tool outputs to markdown
 * for nice display in the side panel.
 */

interface ToolResult {
  ok: boolean;
  output?: any;
  error?: string;
}

export function formatToolOutput(toolName: string, result: ToolResult): string {
  // Handle error cases first
  if (!result.ok) {
    const errorMessage = result.error || 'Unknown error occurred';
    return `Error in ${toolName}: ${errorMessage}`;
  }

  // Handle success cases
  const output = result.output;
  if (!output) return 'No output available.';

  switch (toolName) {
    case 'planner_tool': {
      // Output: { steps: [{ action: string, reasoning: string }] }
      if (!output.steps || !Array.isArray(output.steps)) {
        return JSON.stringify(output);
      }
      return `Created ${output.steps.length} step execution plan`;
    }

    case 'tab_operations':
    case 'tab_operations_tool': {
      // If the tool returned a human-friendly string (e.g. "Created new tab ..."), show it
      if (typeof output === 'string') {
        try {
          const tabs = JSON.parse(output);
          if (Array.isArray(tabs) && tabs.length > 0 && tabs.every(tab => 
            typeof tab === 'object' && 
            typeof tab.id === 'number' && 
            typeof tab.url === 'string' && 
            typeof tab.title === 'string' && 
            typeof tab.windowId === 'number'
          )) {
            // Return raw JSON for tab data to be formatted in UI
            return output;
          }
        } catch {
          // Not JSON array of tabs -> return the message as-is
          return output;
        }
        // String but parsed into non-array structure -> return as-is
        return output;
      }
      
      // If the tool returned an array of tab objects, stringify to JSON so UI can render the formatted list
      if (Array.isArray(output) && output.length > 0 && output.every(tab => 
        typeof tab === 'object' &&
        typeof (tab as any).id === 'number' &&
        typeof (tab as any).url === 'string' &&
        typeof (tab as any).title === 'string' &&
        // windowId may be missing in some contexts; allow either case
        ((tab as any).windowId === undefined || typeof (tab as any).windowId === 'number')
      )) {
        return JSON.stringify(output);
      }
      
      // For non-tab data or errors, return formatted message
      if (Array.isArray(output) && output.length === 0) {
        return 'No open tabs found';
      }
      
      return `Found ${Array.isArray(output) ? output.length : 0} open tabs`;
    }

    case 'validator_tool': {
      // Output: { isComplete: boolean, reasoning: string, suggestions: string[] }
      const status = output.isComplete ? 'Complete' : 'Incomplete';
      return `Task validation: ${status}`;
    }

    case 'extract_tool': {
      // Output: { content: string, reasoning: string }
      if (output && typeof output === 'object' && typeof (output as any).content === 'string') {
        return (output as any).content as string;
      }
      return typeof output === 'string' ? output : JSON.stringify(output);
    }

    case 'todo_manager_tool': {
      // Handle different todo manager actions
      if (output && typeof output === 'object') {
        // For get_next action, show just the content
        if (output.id && output.content && output.status) {
          return output.content;
        }
        // For other actions, show the result message
        if (typeof output === 'string') {
          return output;
        }
      }
      // Fallback to JSON for unknown formats
      return JSON.stringify(output);
    }

    case 'navigation_tool': {
      if (typeof output === 'string') {
        return output;
      }
      // Output: { url: string, success: boolean } or similar
      const navUrl = output.url || 'Unknown URL';
      const navStatus = output.success !== undefined ? (output.success ? 'Success' : 'Failed') : 'Complete';
      return `Navigation - ${navStatus}`;
    }

    case 'find_element':
    case 'find_element_tool': {
      // Some implementations return a JSON string with {found,index,confidence,reasoning}
      if (typeof output === 'string') {
        try {
          const parsed = JSON.parse(output);
          if (typeof parsed === 'object' && parsed) {
            if (typeof parsed.found === 'boolean' && parsed.index !== undefined) {
              return parsed.found
                ? `Found element at index ${parsed.index} (${parsed.confidence || 'unknown'} confidence)`
                : (parsed.reasoning || 'No element found');
            }
          }
          // Unknown JSON structure -> show raw
          return output;
        } catch {
          // Not JSON -> show raw string
          return output;
        }
      }
      // Unknown non-string structure -> stringify
      return JSON.stringify(output);
    }

    case 'classification_tool': {
      // Output: { is_simple_task: boolean }
      const taskType = output.is_simple_task ? 'Simple' : 'Complex';
      return `Task classified as ${taskType}`;
    }

    case 'interact':
    case 'interact_tool': {
      if (typeof output === 'string') {
        return output;
      }
      // Output: { success: boolean, action: string, element?: string }
      const action = (output as any).action || 'Unknown action';
      const status = (output as any).success ? 'Success' : 'Failed';
      return `${action} - ${status}`;
    }

    case 'scroll':
    case 'scroll_tool': {
      if (typeof output === 'string') {
        return output;
      }
      // Output: { success: boolean, direction?: string, amount?: number }
      const direction = (output as any).direction || 'Unknown direction';
      const amount = (output as any).amount !== undefined ? `${(output as any).amount}px` : '';
      const status = (output as any).success ? 'Success' : 'Failed';
      return `Scrolled ${direction} ${amount} - ${status}`;
    }

    case 'search':
    case 'search_tool': {
      // Many implementations return a descriptive string (e.g., Searched for "..." on ...)
      if (typeof output === 'string') {
        return output;
      }
      // Otherwise, attempt structured rendering
      const anyOut = output as any;
      if (!anyOut?.matches || !Array.isArray(anyOut.matches)) {
        return JSON.stringify(output);
      }
      const query = anyOut.query || 'Unknown query';
      if (anyOut.matches.length === 0) {
        return `No matches found for "${query}"`;
      }
      return `Found ${anyOut.matches.length} match${anyOut.matches.length > 1 ? 'es' : ''} for "${query}"`;
    }

    case 'refresh_browser_state_tool': {
      // Output: Browser state snapshot (potentially large)
      return 'Browser state refreshed';
    }

    case 'group_tabs':
    case 'group_tabs_tool': {
      if (typeof output === 'string') {
        return output;
      }
      // Output: { groups: [{ name: string, tabs: [...] }] }
      const anyOut = output as any;
      if (!anyOut?.groups || !Array.isArray(anyOut.groups)) {
        return JSON.stringify(output);
      }
      return `Created ${anyOut.groups.length} tab group${anyOut.groups.length > 1 ? 's' : ''}`;
    }

    case 'get_selected_tabs':
    case 'get_selected_tabs_tool': {
      // Return raw JSON for selected tab data so it can be properly formatted in the UI
      if (typeof output === 'string') {
        try {
          const tabs = JSON.parse(output);
          if (Array.isArray(tabs) && tabs.length > 0 && tabs.every(tab => 
            typeof tab === 'object' && 
            typeof tab.id === 'number' && 
            typeof tab.url === 'string' && 
            typeof tab.title === 'string'
          )) {
            // Return raw JSON for tab data to be formatted in UI
            return output;
          }
        } catch {
          // If parsing fails, return as-is
          return output;
        }
        // String but parsed into non-array structure -> return as-is
        return output;
      }
      
      // For non-tab data or errors, return formatted message
      if (Array.isArray(output) && output.length === 0) {
        return 'No selected tabs found';
      }
      
      return `Found ${Array.isArray(output) ? output.length : 0} selected tab${Array.isArray(output) && output.length !== 1 ? 's' : ''}`;
    }

    case 'done_tool': {
      // Output: { status?: string, message?: string }
      if (output.message) {
        return output.message;
      } else if (output.status) {
        return `Task complete: ${output.status}`;
      } else {
        return 'Task complete';
      }
    }

    default:
      // Fallback: return raw string outputs, otherwise JSON-stringify objects
      return typeof output === 'string' ? output : JSON.stringify(output);
  }
}