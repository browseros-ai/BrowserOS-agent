import { StreamEventBus } from '@/lib/events';
// import { ToolRegistry } from '@/lib/tools/base/ToolRegistry';
// import { ActionResult, ActionResultBuilder, extractContent } from '@/lib/types/ActionResult';
import { Logging } from '@/lib/utils/Logging';

/**
 * Processes LangChain streaming events and converts them to unified StreamEvents
 */
export class StreamEventProcessor {
  private eventBus: StreamEventBus;
  // private toolRegistry: ToolRegistry;
  
  // State tracking
  private currentSegmentId: number = 0;
  private currentSegmentContent: string = '';
  private messageIdCounter: number = 0;
  private segmentMessageIds: Map<number, string> = new Map();
  private isProcessingTool: boolean = false;
  private stepCount: number = 0;
  // private actionResults: ActionResult[] = [];
  private currentToolName: string = '';
  private currentToolArgs: any = {};
  private abortSignal?: AbortSignal;

  constructor(
    eventBus: StreamEventBus,
    // toolRegistry: ToolRegistry,
    abortSignal?: AbortSignal
  ) {
    this.eventBus = eventBus;
    // this.toolRegistry = toolRegistry;
    this.abortSignal = abortSignal;
  }

  /**
   * Process a LangChain streaming event
   */
  async processEvent(event: any): Promise<void> {
    // Check for cancellation
    if (this.abortSignal?.aborted) {
      return;
    }

    const eventType = event.event;
    
    try {
      switch (eventType) {
        case 'on_chat_model_stream':
          this.handleChatModelStream(event);
          break;

        case 'on_tool_start':
          this.handleToolStart(event);
          break;

        case 'on_tool_stream':
          this.handleToolStream(event);
          break;

        case 'on_tool_end':
          this.handleToolEnd(event);
          break;

        case 'on_chain_start':
          if (event.name === 'RunnableAgent' || event.name === 'agent') {
            this.handleAgentStart();
          }
          break;

        case 'on_llm_end':
          this.handleLlmEnd();
          break;

        case 'on_chain_error':
        case 'on_tool_error':
          this.handleError(event);
          break;
      }
    } catch (error) {
      Logging.log('StreamEventProcessor', `Error processing event: ${error}`, 'error');
      this.eventBus.emitError(
        error instanceof Error ? error.message : String(error),
        undefined,
        false,
        'StreamEventProcessor'
      );
    }
  }

  /**
   * Complete streaming and finalize any remaining content
   */
  completeStreaming(): void {
    // Finalize any remaining segment content
    this.finalizeCurrentSegment('StreamEventProcessor');
  }

  /**
   * Handle chat model streaming (LLM responses)
   */
  private handleChatModelStream(event: any): void {
    const chunk = event.data?.chunk;
    if (!chunk?.content) return;

    let textContent = '';
    if (typeof chunk.content === 'string') {
      textContent = chunk.content;
    } else if (Array.isArray(chunk.content)) {
      const textParts = chunk.content.filter((c: any) => c.type === 'text');
      textContent = textParts.map((c: any) => c.text || '').join('');
    }

    if (!textContent) return;

    // Start new segment if needed
    if (!this.segmentMessageIds.has(this.currentSegmentId)) {
      const messageId = this.generateMessageId();
      this.segmentMessageIds.set(this.currentSegmentId, messageId);
      this.eventBus.emitSegmentStart(this.currentSegmentId, messageId, 'chat_model');
    }

    // Accumulate content
    this.currentSegmentContent += textContent;

    // Emit chunk event
    const messageId = this.segmentMessageIds.get(this.currentSegmentId)!;
    this.eventBus.emitSegmentChunk(
      this.currentSegmentId,
      textContent,
      messageId,
      'chat_model'
    );
  }

  /**
   * Handle tool start
   */
  private handleToolStart(event: any): void {
    // Finalize any pending LLM segment
    this.finalizeCurrentSegment('chat_model', true);

    const toolName = event.name || 'unknown';
    const toolInput = event.data?.input || {};

    this.isProcessingTool = true;
    this.stepCount++;
    this.currentToolName = toolName;

    // Parse tool arguments
    let args = toolInput;
    if (typeof toolInput === 'string') {
      try {
        args = JSON.parse(toolInput);
      } catch {
        args = { input: toolInput };
      }
    }

    // Store current tool args for use in handleToolEnd
    this.currentToolArgs = args;

    // Get display information from tool
    const displayInfo = this.fetchToolMetadata(toolName, args);

    // Emit tool start event
    this.eventBus.emitToolStart({
      toolName,
      displayName: displayInfo.displayName,
      icon: displayInfo.icon,
      description: displayInfo.description,
      args
    }, 'tool_executor');
  }

  /**
   * Handle tool streaming
   */
  private handleToolStream(event: any): void {
    const toolName = event.name || 'unknown';
    const chunk = event.data?.chunk;

    if (!chunk) return;

    let streamContent = '';
    if (typeof chunk === 'string') {
      streamContent = chunk;
    } else if (chunk.content) {
      streamContent = chunk.content;
    } else if (chunk.output) {
      streamContent = chunk.output;
    } else {
      streamContent = JSON.stringify(chunk);
    }

    if (streamContent) {
      this.eventBus.emitToolStream(toolName, streamContent, 'tool_executor');
    }
  }

  /**
   * Handle tool end
   */
  private handleToolEnd(event: any): void {
    const toolName = event.name || 'unknown';
    const output = event.data?.output || '';

    this.isProcessingTool = false;

    // Format tool result
    let result = '';
    if (typeof output === 'string') {
      result = output;
    } else if (typeof output === 'object') {
      result = JSON.stringify(output, null, 2);
    }

    // Extract tool output for display
    let toolOutputArgs: any = {};
    try {
      if (result) {
        const parsed = JSON.parse(result);
        
        // Handle LangChain ToolMessage wrapper
        if (this.isLangChainToolMessage(parsed)) {
          toolOutputArgs = JSON.parse(parsed.kwargs.content);
        } else {
          toolOutputArgs = parsed;
        }
      }
    } catch {
      toolOutputArgs = { output: result };
    }

    // Create ActionResult for tracking
    // const actionResult = this.buildActionResultFromOutput(toolName, toolOutputArgs);
    // this.actionResults.push(actionResult);

    // Get display information using the original input args
    const displayInfo = this.fetchToolMetadata(toolName, this.currentToolArgs);

    // Clean result for display
    const cleanResult = this.formatToolResultForDisplay(result);

    // Emit tool end event
    this.eventBus.emitToolEnd({
      toolName,
      displayName: displayInfo.displayName,
      result: cleanResult,
      rawResult: toolOutputArgs,
      success: !toolOutputArgs.error
    }, 'tool_executor');

    // Start new segment for following content
    this.currentSegmentId++;
  }

  /**
   * Handle agent start
   */
  private handleAgentStart(): void {
    this.stepCount++;
    const messageId = this.generateMessageId();
    this.segmentMessageIds.set(this.currentSegmentId, messageId);
    this.eventBus.emitSegmentStart(this.currentSegmentId, messageId, 'agent');
  }

  /**
   * Handle LLM end
   */
  private handleLlmEnd(): void {
    // Finalize current segment if it has content and we're not processing a tool
    if (!this.isProcessingTool) {
      this.finalizeCurrentSegment('chat_model');
    }
  }

  /**
   * Handle errors
   */
  private handleError(event: any): void {
    const errorMessage = event.data?.error || event.error || 'Unknown error occurred';

    // Check for known non-critical errors
    if (errorMessage.includes('ToolNode only accepts AIMessages as input')) {
      // Known LangGraph streaming issue - ignore
      Logging.log('StreamEventProcessor', `[KNOWN_ISSUE] ${errorMessage}`, 'info');
      return;
    }

    // Check for cancellation errors
    if (errorMessage.includes('AbortError') || 
        errorMessage.includes('Aborted') || 
        errorMessage.includes('cancelled') ||
        errorMessage.includes('stopped')) {
      // Cancellation - don't show as error
      Logging.log('StreamEventProcessor', `[CANCELLATION] ${errorMessage}`, 'info');
      return;
    }

    // Emit error event
    this.eventBus.emitError(errorMessage, undefined, false, 'StreamEventProcessor');
  }

  /**
   * Helper methods
   */

  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Finalize the current segment if it has content
   */
  private finalizeCurrentSegment(source: string, incrementSegmentId: boolean = false): void {
    if (this.currentSegmentContent) {
      const messageId = this.segmentMessageIds.get(this.currentSegmentId) || this.generateMessageId();
      this.eventBus.emitSegmentEnd(
        this.currentSegmentId,
        this.currentSegmentContent,
        messageId,
        source
      );
      this.currentSegmentContent = '';
      
      if (incrementSegmentId) {
        this.currentSegmentId++;
      }
    } else if (incrementSegmentId) {
      // Even if no content, increment segment ID if requested
      this.currentSegmentId++;
    }
  }

  private fetchToolMetadata(toolName: string, args: any): { 
    displayName: string; 
    icon: string; 
    description: string;
  } {
    // if (!this.toolRegistry) {
    //   throw new Error('ToolRegistry is required for StreamEventProcessor');
    // }

    // const tool = this.toolRegistry.getByName(toolName);
    // if (!tool) {
    //   throw new Error(`Tool '${toolName}' not found in registry`);
    // }
    const tool = null;

    let processedArgs = args;
    
    // Handle case where args has an 'input' property containing a JSON string
    if (args && typeof args === 'object' && typeof args.input === 'string') {
      try {
        // Try to parse the input string as JSON
        processedArgs = JSON.parse(args.input);
      } catch {
        // If parsing fails, keep the original args
        processedArgs = args;
      }
    }
    // Handle case where entire args is a JSON string
    else if (typeof args === 'string') {
      try {
        processedArgs = JSON.parse(args);
      } catch {
        // If parsing fails, keep as is
        processedArgs = args;
      }
    }

    // return tool.getToolMetadata(processedArgs);
    // For now, return a default metadata object
    return {
      displayName: toolName,
      icon: '🔧',
      description: `Executing ${toolName}`
    };
  }

  private formatToolResultForDisplay(result: string): string {
    if (!result) return 'Completed';

    try {
      const parsed = JSON.parse(result);

      // Handle LangChain ToolMessage wrapper
      let actualContent = parsed;
      if (this.isLangChainToolMessage(parsed)) {
        actualContent = JSON.parse(parsed.kwargs.content);
      }

      // Use tool's own display formatting
      if (actualContent._displayResult) {
        return actualContent._displayResult;
      }

      // Fallback
      if (actualContent.message) {
        return actualContent.message;
      }

      return 'Completed successfully';
    } catch (error) {
      // Not JSON, return truncated
      return result.length > 150 ? `${result.substring(0, 150).trim()}...` : result.trim();
    }
  }

  private isLangChainToolMessage(parsed: any): boolean {
    return parsed &&
      parsed.lc === 1 &&
      parsed.type === 'constructor' &&
      parsed.id &&
      Array.isArray(parsed.id) &&
      parsed.id.includes('ToolMessage') &&
      parsed.kwargs?.content;
  }

  // private buildActionResultFromOutput(toolName: string, output: any): ActionResult {
  //   const builder = new ActionResultBuilder(toolName);
  //   const content = extractContent(toolName, output);
  //   builder.setExtractedContent(content);
  //   return builder.build();
  // }

  /**
   * Get collected data
   */
  getStepCount(): number {
    return this.stepCount;
  }

  // getActionResults(): ActionResult[] {
  //   return this.actionResults;
  // }

  /**
   * Reset processor state
   */
  resetProcessorState(): void {
    this.currentSegmentId = 0;
    this.currentSegmentContent = '';
    this.messageIdCounter = 0;
    this.segmentMessageIds.clear();
    this.isProcessingTool = false;
    this.stepCount = 0;
    // this.actionResults = [];
    this.currentToolName = '';
    this.currentToolArgs = {};
  }
}
