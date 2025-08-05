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
    return `❌ Error in ${toolName}: ${errorMessage}`;
  }

  // Handle success cases
  const output = result.output;
  if (!output) return 'No output available.';

  switch (toolName) {
    case 'planner_tool': {
      // Output: { steps: [{ action: string, reasoning: string }] }
      if (!output.steps || !Array.isArray(output.steps)) {
        return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
      }
      let planMd = '#### 📋 Execution Plan\n\n';
      output.steps.forEach((step: any, idx: number) => {
        planMd += `**Step ${idx + 1}:** ${step.action}\n`;
        if (step.reasoning) {
          planMd += `*Reasoning:* ${step.reasoning}\n`;
        }
        planMd += '\n';
      });
      return planMd.trim();
    }

    case 'tab_operations_tool': {
      // Output is a JSON string array that needs to be parsed
      let tabs = output;
      if (typeof output === 'string') {
        try {
          tabs = JSON.parse(output);
        } catch {
          return output; // Return as-is if not valid JSON
        }
      }
      
      if (!Array.isArray(tabs)) {
        return '```json\n' + JSON.stringify(tabs, null, 2) + '\n```';
      }
      
      if (tabs.length === 0) {
        return '#### 📑 No Open Tabs';
      }
      
      let tabMd = `#### 📑 Open Tabs (${tabs.length})\n\n`;
      tabMd += '| ID | Title | URL |\n| -- | ----- | --- |\n';
      tabs.forEach((tab: any) => {
        const title = tab.title || 'Untitled';
        const url = tab.url || '';
        // Truncate long titles and URLs for better display
        const displayTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
        const displayUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
        tabMd += `| ${tab.id} | ${displayTitle} | ${displayUrl} |\n`;
      });
      return tabMd.trim();
    }

    case 'validator_tool': {
      // Output: { isComplete: boolean, reasoning: string, suggestions: string[] }
      let validatorMd = '#### ✅ Validation Result\n\n';
      validatorMd += `**Complete?** ${output.isComplete ? 'Yes ✓' : 'No ✗'}\n\n`;
      if (output.reasoning) {
        validatorMd += `**Reasoning:** ${output.reasoning}\n\n`;
      }
      if (output.suggestions && Array.isArray(output.suggestions) && output.suggestions.length > 0) {
        validatorMd += '**Suggestions:**\n';
        output.suggestions.forEach((sugg: string) => validatorMd += `- ${sugg}\n`);
      }
      return validatorMd.trim();
    }

    case 'navigation_tool': {
      // Output: { url: string, success: boolean } or similar
      const navUrl = output.url || 'Unknown URL';
      const navStatus = output.success !== undefined ? (output.success ? '✓ Success' : '✗ Failed') : 'Complete';
      return `#### 🧭 Navigation\n\n**URL:** ${navUrl}\n**Status:** ${navStatus}`;
    }

    case 'find_element_tool': {
      // Output: { elements: [{ selector: string, text: string, position: {x,y} }] }
      if (!output.elements || !Array.isArray(output.elements)) {
        return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
      }
      if (output.elements.length === 0) {
        return '#### 🔍 No Elements Found';
      }
      let elementMd = `#### 🔍 Found ${output.elements.length} Element${output.elements.length > 1 ? 's' : ''}\n\n`;
      output.elements.forEach((el: any, idx: number) => {
        elementMd += `**Element ${idx + 1}:**\n`;
        if (el.selector) elementMd += `- Selector: \`${el.selector}\`\n`;
        if (el.text) elementMd += `- Text: "${el.text}"\n`;
        if (el.position) elementMd += `- Position: (${el.position.x}, ${el.position.y})\n`;
        elementMd += '\n';
      });
      return elementMd.trim();
    }

    case 'classification_tool': {
      // Output: { is_simple_task: boolean }
      const taskType = output.is_simple_task ? 'Simple' : 'Complex';
      return `#### 🏷️ Task Classification\n\n**Type:** ${taskType} Task`;
    }

    case 'interaction_tool': {
      // Output: { success: boolean, action: string, element?: string }
      let interactionMd = '#### 🖱️ Interaction\n\n';
      if (output.action) interactionMd += `**Action:** ${output.action}\n`;
      if (output.element) interactionMd += `**Element:** ${output.element}\n`;
      interactionMd += `**Status:** ${output.success ? '✓ Success' : '✗ Failed'}`;
      return interactionMd.trim();
    }

    case 'scroll_tool': {
      // Output: { success: boolean, direction?: string, amount?: number }
      let scrollMd = '#### 📜 Scroll\n\n';
      if (output.direction) scrollMd += `**Direction:** ${output.direction}\n`;
      if (output.amount !== undefined) scrollMd += `**Amount:** ${output.amount}px\n`;
      scrollMd += `**Status:** ${output.success ? '✓ Success' : '✗ Failed'}`;
      return scrollMd.trim();
    }

    case 'search_tool': {
      // Output: { matches: [{ text: string, selector: string }], query: string }
      if (!output.matches || !Array.isArray(output.matches)) {
        return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
      }
      let searchMd = '#### 🔎 Search Results\n\n';
      if (output.query) searchMd += `**Query:** "${output.query}"\n\n`;
      if (output.matches.length === 0) {
        searchMd += '*No matches found*';
      } else {
        searchMd += `**Found ${output.matches.length} match${output.matches.length > 1 ? 'es' : ''}:**\n\n`;
        output.matches.forEach((match: any, idx: number) => {
          searchMd += `${idx + 1}. "${match.text}"\n`;
          if (match.selector) searchMd += `   Selector: \`${match.selector}\`\n`;
        });
      }
      return searchMd.trim();
    }

    case 'refresh_browser_state_tool': {
      // Output: Browser state snapshot (potentially large)
      return '#### 🔄 Browser State Refreshed\n\nCurrent page state has been captured and updated.';
    }

    case 'group_tabs_tool': {
      // Output: { groups: [{ name: string, tabs: [...] }] }
      if (!output.groups || !Array.isArray(output.groups)) {
        return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
      }
      let groupMd = '#### 📁 Tab Groups\n\n';
      output.groups.forEach((group: any) => {
        groupMd += `**${group.name || 'Unnamed Group'}**\n`;
        if (group.tabs && Array.isArray(group.tabs)) {
          group.tabs.forEach((tab: any) => {
            groupMd += `- ${tab.title || 'Untitled'}\n`;
          });
        }
        groupMd += '\n';
      });
      return groupMd.trim();
    }

    case 'done_tool': {
      // Output: { status?: string, message?: string }
      let doneMd = '#### 🎉 Task Complete\n\n';
      if (output.message) {
        doneMd += output.message;
      } else if (output.status) {
        doneMd += `Status: ${output.status}`;
      } else {
        doneMd += 'The task has been completed successfully.';
      }
      return doneMd;
    }

    case 'todo_manager_tool': {
      // Output: string (success message) or XML for list action
      if (typeof output === 'string') {
        return output;
      }
      return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
    }

    default:
      // Fallback to pretty-printed JSON in a code block
      return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
  }
}