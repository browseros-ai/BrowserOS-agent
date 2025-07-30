import { EventBus } from '@/lib/events/EventBus';
import { formatToolOutput } from '@/lib/tools/formatToolOutput';

/**
 * High-level event processor for BrowserAgent
 * Provides clear, semantic methods for agent operations
 */
export class EventProcessor {
  private eventBus: EventBus;
  private currentSegmentId: number = 0;
  private currentMessageId: string = '';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }



  /**
   * Start agent thinking/response (returns messageId for streaming)
   */
  startThinking(): string {
    this.currentSegmentId++;
    this.currentMessageId = this._generateMessageId();
    this.eventBus.emitSegmentStart(
      this.currentSegmentId,
      this.currentMessageId,
      'BrowserAgent'
    );
    return this.currentMessageId;
  }

  /**
   * Stream agent response content
   */
  streamThoughtDuringThinking(content: string): void {
    if (!this.currentMessageId) return;
    
    this.eventBus.emitSegmentChunk(
      this.currentSegmentId,
      content,
      this.currentMessageId,
      'BrowserAgent'
    );
  }

  /**
   * Complete agent thinking/response
   */
  finishThinking(fullContent: string): void {
    if (!this.currentMessageId) return;
    
    this.eventBus.emitSegmentEnd(
      this.currentSegmentId,
      fullContent,
      this.currentMessageId,
      'BrowserAgent'
    );
  }

  /**
   * Emit tool execution start
   */
  executingTool(toolName: string, args?: any): void {
    const displayInfo = this._getToolDisplayInfo(toolName, args);
    
    this.eventBus.emitToolStart({
      toolName,
      displayName: displayInfo.name,
      icon: displayInfo.icon,
      description: displayInfo.description,
      args: args || {}
    }, 'BrowserAgent');
  }

  /**
   * Emit tool execution end (for debug mode)
   */
  toolEnd(toolName: string, success: boolean, summary?: string): void {
    const displayName = this._getToolDisplayInfo(toolName).name;
    
    this.eventBus.emitToolEnd({
      toolName,
      displayName,
      result: summary || (success ? 'Completed' : 'Failed'),
      rawResult: {},
      success
    }, 'BrowserAgent');
  }

  /**
   * Emit tool result for display (always shown)
   */
  emitToolResult(toolName: string, result: string): void {
    const displayName = this._getToolDisplayInfo(toolName).name;
    
    // Parse result to get formatted content
    let parsedResult;
    let success = false;
    try {
      parsedResult = JSON.parse(result);
      success = parsedResult.ok || false;
    } catch {
      // If not JSON, create a simple result object
      parsedResult = { ok: true, output: result };
      success = true;
    }
    
    const formattedContent = formatToolOutput(toolName, parsedResult);
    
    this.eventBus.emitToolResult({
      toolName,
      displayName,
      content: formattedContent,
      success,
      isJson: true
    }, 'BrowserAgent');
  }


  /**
   * Emit info message
   */
  info(message: string): void {
    this.eventBus.emitSystemMessage(message, 'info', 'BrowserAgent');
  }

  /**
   * Emit error
   */
  error(message: string, fatal: boolean = false): void {
    this.eventBus.emitError(message, undefined, fatal, 'BrowserAgent');
  }

  /**
   * Emit debug message (only shown when debug mode is enabled)
   */
  debug(message: string, data?: any): void {
    this.eventBus.emitDebug(message, data, 'BrowserAgent');
  }

  /**
   * Emit task result summary
   */
  emitTaskResult(success: boolean, message: string): void {
    this.eventBus.emitTaskResult(success, message, 'BrowserAgent');
  }

  // Private helper methods
  private _generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private _getToolDisplayInfo(toolName: string, args?: any): {
    name: string;
    icon: string;
    description: string;
  } {
    // Tool display mapping
    const toolInfo: Record<string, { name: string; icon: string; description?: (args: any) => string }> = {
      'classification_tool': {
        name: 'Task Analysis',
        icon: '🔍',
        description: () => 'Analyzing task complexity'
      },
      'planner_tool': {
        name: 'Planning',
        icon: '📋',
        description: (args) => `Creating ${args?.max_steps || 3}-step plan`
      },
      'navigation_tool': {
        name: 'Navigation',
        icon: '🌐',
        description: (args) => args?.url ? `Navigating to ${args.url}` : 'Navigating to page'
      },
      'tab_operations_tool': {
        name: 'Tab Operations',
        icon: '📑',
        description: (args) => {
          if (args?.action === 'list') return 'Listing tabs in current window';
          if (args?.action === 'list_all') return 'Listing all tabs';
          if (args?.action === 'new') return 'Creating new tab';
          if (args?.action === 'switch') return 'Switching tabs';
          if (args?.action === 'close') return 'Closing tabs';
          return args?.action || 'Managing tabs';
        }
      },
      'done_tool': {
        name: 'Completion',
        icon: '✅',
        description: () => 'Marking task as complete'
      }
    };

    const info = toolInfo[toolName] || {
      name: toolName,
      icon: '🔧',
      description: () => `Executing ${toolName}`
    };

    return {
      name: info.name,
      icon: info.icon,
      description: info.description ? info.description(args) : `Executing ${info.name}`
    };
  }
}