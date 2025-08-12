import { EventBus, StreamEvent } from './EventBus';
import { MessageType } from '@/lib/types/messaging';

/**
 * Simplified UI message types that map to our stream events
 */
export enum UIMessageType {
  SystemMessage = 'SystemMessage',
  ThinkingMessage = 'ThinkingMessage',
  NewSegment = 'NewSegment',
  StreamingChunk = 'StreamingChunk',
  FinalizeSegment = 'FinalizeSegment',
  ToolStart = 'ToolStart',
  ToolStream = 'ToolStream',
  ToolEnd = 'ToolEnd',
  ToolResult = 'ToolResult',
  DebugMessage = 'DebugMessage',
  ErrorMessage = 'ErrorMessage',
  CancelMessage = 'CancelMessage',
  TaskResult = 'TaskResult'
}

/**
 * UI message payload structure
 */
export interface UIMessage {
  messageType: UIMessageType;
  messageId?: string;
  segmentId?: number;
  content?: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: string;
  success?: boolean;
  error?: string;
  data?: any;
}

/**
 * Handler that converts StreamEvents to UI messages
 * This bridges the EventBus to the UI port messaging system
 */
export class UIEventHandler {
  private eventBus: EventBus;
  private sendToUI: (type: MessageType, payload: any) => void;
  private messageIdMap: Map<number, string> = new Map();

  constructor(
    eventBus: EventBus,
    sendToUI: (type: MessageType, payload: any) => void
  ) {
    this.eventBus = eventBus;
    this.sendToUI = sendToUI;
    this.setupEventListeners();
  }

  /**
   * Set up listeners for all event types
   */
  private setupEventListeners(): void {
    // Segment events
    this.eventBus.onStreamEvent('segment.start', this.handleSegmentStart.bind(this));
    this.eventBus.onStreamEvent('segment.chunk', this.handleSegmentChunk.bind(this));
    this.eventBus.onStreamEvent('segment.end', this.handleSegmentEnd.bind(this));

    // Tool events
    this.eventBus.onStreamEvent('tool.start', this.handleToolStart.bind(this));
    this.eventBus.onStreamEvent('tool.stream', this.handleToolStream.bind(this));
    this.eventBus.onStreamEvent('tool.end', this.handleToolEnd.bind(this));
    this.eventBus.onStreamEvent('tool.result', this.handleToolResult.bind(this));

    // System events
    this.eventBus.onStreamEvent('system.message', this.handleSystemMessage.bind(this));
    this.eventBus.onStreamEvent('system.thinking', this.handleSystemThinking.bind(this));
    this.eventBus.onStreamEvent('system.error', this.handleSystemError.bind(this));
    this.eventBus.onStreamEvent('system.cancel', this.handleSystemCancel.bind(this));
    
    // Task events
    this.eventBus.onStreamEvent('task.result', this.handleTaskResult.bind(this));

    // Debug events
    this.eventBus.onStreamEvent('debug.message', this.handleDebugMessage.bind(this));
  }

  /**
   * Send a UI message via port messaging
   */
  private sendUIMessage(message: UIMessage): void {
    this.sendToUI(MessageType.AGENT_STREAM_UPDATE, {
      step: Date.now(),  // Use timestamp as step for compatibility
      action: message.messageType,
      status: 'executing',
      details: message
    });
  }

  /**
   * Event handlers
   */

  private handleSegmentStart(event: StreamEvent): void {
    const { segmentId, messageId } = event.data as any;
    
    // Store message ID mapping
    this.messageIdMap.set(segmentId, messageId);
    
    this.sendUIMessage({
      messageType: UIMessageType.NewSegment,
      messageId,
      segmentId
    });
  }

  private handleSegmentChunk(event: StreamEvent): void {
    const { segmentId, content, messageId } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.StreamingChunk,
      messageId,
      segmentId,
      content
    });
  }

  private handleSegmentEnd(event: StreamEvent): void {
    const { segmentId, finalContent, messageId } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.FinalizeSegment,
      messageId,
      segmentId,
      content: finalContent
    });
  }

  private handleToolStart(event: StreamEvent): void {
    const { toolName, displayName, icon, description, args } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.ToolStart,
      toolName: toolName,
      toolArgs: {
        description,
        icon,
        args
      }
    });
  }

  private handleToolStream(event: StreamEvent): void {
    const { toolName, content } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.ToolStream,
      toolName,
      content
    });
  }

  private handleToolEnd(event: StreamEvent): void {
    const { toolName, displayName, result } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.ToolEnd,
      toolName: toolName,
      toolResult: result,
      content: result  // For backward compatibility
    });
  }

  private handleToolResult(event: StreamEvent): void {
    const { toolName, displayName, content, success } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.ToolResult,
      toolName: toolName,
      content: content,
      success: success
    });
  }

  private handleSystemMessage(event: StreamEvent): void {
    const { message, category } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.SystemMessage,
      content: message,
      data: { category }
    });
  }

  private handleSystemError(event: StreamEvent): void {
    const { error } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.ErrorMessage,
      error,
      content: error  // For display
    });
  }


  private handleSystemCancel(event: StreamEvent): void {
    const { reason, userInitiated } = event.data as any;
    
    if (userInitiated) {
      this.sendUIMessage({
        messageType: UIMessageType.CancelMessage,
        content: reason || '✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!'
      });
    }
  }

  private handleSystemThinking(event: StreamEvent): void {
    const { message, category } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.ThinkingMessage,
      content: message,
      data: { category }
    });
  }

  private handleDebugMessage(event: StreamEvent): void {
    const { message, data } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.DebugMessage,
      content: message,
      data
    });
  }

  private handleTaskResult(event: StreamEvent): void {
    const { success, message } = event.data as any;
    
    this.sendUIMessage({
      messageType: UIMessageType.TaskResult,
      content: message,
      success: success
    });
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.eventBus.removeAllListeners();
    this.messageIdMap.clear();
  }

  /**
   * Replay events for a late subscriber
   */
  replay(): void {
    this.eventBus.replay((event) => {
      // Re-emit the event to trigger handlers
      this.eventBus.emitStreamEvent(event);
    });
  }
}