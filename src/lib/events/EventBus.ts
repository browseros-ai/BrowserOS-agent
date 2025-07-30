import { EventEmitter } from 'events';
import { z } from 'zod';
import { Logging } from '@/lib/utils/Logging';

/**
 * Stream event types for the unified event system
 */
export const StreamEventTypeSchema = z.enum([
  'segment.start',      // Start new content segment (LLM response)
  'segment.chunk',      // Streaming content chunk
  'segment.end',        // Finalize segment
  'tool.start',         // Tool execution started
  'tool.stream',        // Tool streaming output
  'tool.end',           // Tool completed
  'system.message',     // System messages
  'system.thinking',    // Thinking/progress messages (replaceable)
  'system.error',       // Error messages
  'system.complete',    // Task complete
  'system.cancel',      // Task cancelled
  'debug.message'       // Debug messages
]);

export type StreamEventType = z.infer<typeof StreamEventTypeSchema>;

/**
 * Base stream event schema
 */
export const StreamEventSchema = z.object({
  id: z.string(),  // Unique event ID
  type: StreamEventTypeSchema,  // Event type
  timestamp: z.number(),  // Unix timestamp
  source: z.string().optional(),  // Source component (agent name, etc)
  data: z.record(z.unknown())  // Event-specific data
});

export type StreamEvent = z.infer<typeof StreamEventSchema>;

/**
 * Event data schemas for each event type
 */
export const SegmentStartDataSchema = z.object({
  segmentId: z.number(),  // Unique segment identifier
  messageId: z.string()  // Message ID for UI tracking
});

export const SegmentChunkDataSchema = z.object({
  segmentId: z.number(),  // Segment this chunk belongs to
  content: z.string(),  // Text content
  messageId: z.string()  // Message ID for UI tracking
});

export const SegmentEndDataSchema = z.object({
  segmentId: z.number(),  // Segment to finalize
  finalContent: z.string(),  // Complete segment content
  messageId: z.string()  // Message ID for UI tracking
});

export const ToolStartDataSchema = z.object({
  toolName: z.string(),  // Internal tool name
  displayName: z.string(),  // User-friendly display name
  icon: z.string(),  // Tool icon/emoji
  description: z.string(),  // What the tool is doing
  args: z.record(z.unknown())  // Tool arguments
});

export const ToolStreamDataSchema = z.object({
  toolName: z.string(),  // Tool name
  content: z.string()  // Streaming content
});

export const ToolEndDataSchema = z.object({
  toolName: z.string(),  // Tool name
  displayName: z.string(),  // User-friendly display name
  result: z.string(),  // Formatted result for display
  rawResult: z.unknown().optional(),  // Raw result data
  success: z.boolean()  // Whether tool succeeded
});

export const SystemMessageDataSchema = z.object({
  message: z.string(),  // System message
  level: z.enum(['info', 'warning', 'error']).default('info')  // Message level
});

export const SystemThinkingDataSchema = z.object({
  message: z.string(),  // Thinking/progress message
  category: z.string().optional()  // Category for grouping (e.g., 'setup', 'validation')
});

export const SystemErrorDataSchema = z.object({
  error: z.string(),  // Error message
  code: z.string().optional(),  // Error code
  fatal: z.boolean().default(false)  // Whether error is fatal
});

export const SystemCompleteDataSchema = z.object({
  success: z.boolean(),  // Whether task succeeded
  message: z.string().optional()  // Completion message
});

export const SystemCancelDataSchema = z.object({
  reason: z.string().optional(),  // Cancellation reason
  userInitiated: z.boolean().default(true)  // Whether user cancelled
});

export const DebugMessageDataSchema = z.object({
  message: z.string(),  // Debug message
  data: z.unknown().optional()  // Additional debug data
});

/**
 * Event listener type
 */
export type EventListener<T = StreamEvent> = (event: T) => void | Promise<void>;

/**
 * Event filter function type
 */
export type EventFilter = (event: StreamEvent) => boolean;

/**
 * EventBus for streaming events with replay capability
 */
export class EventBus extends EventEmitter {
  private eventBuffer: StreamEvent[] = [];
  private bufferSize: number;
  private debugMode: boolean;
  private eventCounter: number = 0;

  constructor(options: { bufferSize?: number; debugMode?: boolean } = {}) {
    super();
    this.bufferSize = options.bufferSize || 100;
    this.debugMode = options.debugMode || false;
    this.setMaxListeners(50);  // Allow many listeners
  }

  /**
   * Emit a stream event
   */
  emitStreamEvent(event: Omit<StreamEvent, 'id' | 'timestamp'>): boolean {
    // Add ID and timestamp
    const completeEvent: StreamEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now()
    };

    // Validate event
    try {
      StreamEventSchema.parse(completeEvent);
    } catch (error) {
      Logging.log('StreamEventBus', `Invalid event: ${error}`, 'error');
      return false;
    }

    // Add to buffer
    this.addToBuffer(completeEvent);

    // Log if debug mode
    if (this.debugMode) {
      Logging.log('StreamEventBus', `Emitting ${completeEvent.type} event`, 'info');
    }

    // Emit to type-specific listeners
    super.emit(completeEvent.type, completeEvent);
    
    // Emit to wildcard listeners
    super.emit('*', completeEvent);

    return true;
  }

  /**
   * Subscribe to specific event type(s)
   */
  onStreamEvent(eventType: StreamEventType | StreamEventType[] | '*', listener: EventListener): this {
    if (Array.isArray(eventType)) {
      eventType.forEach(type => super.on(type, listener));
    } else {
      super.on(eventType, listener);
    }
    return this;
  }

  /**
   * Subscribe once to specific event type
   */
  onceStreamEvent(eventType: StreamEventType | '*', listener: EventListener): this {
    return super.once(eventType, listener);
  }

  /**
   * Unsubscribe from event type(s)
   */
  offStreamEvent(eventType: StreamEventType | StreamEventType[] | '*', listener: EventListener): this {
    if (Array.isArray(eventType)) {
      eventType.forEach(type => super.off(type, listener));
    } else {
      super.off(eventType, listener);
    }
    return this;
  }

  /**
   * Subscribe with a filter
   */
  onFiltered(filter: EventFilter, listener: EventListener): () => void {
    const filteredListener = (event: StreamEvent) => {
      if (filter(event)) {
        listener(event);
      }
    };

    super.on('*', filteredListener);

    // Return unsubscribe function
    return () => super.off('*', filteredListener);
  }

  /**
   * Wait for a specific event type (promise-based)
   */
  async waitFor(
    eventType: StreamEventType,
    timeout?: number,
    filter?: EventFilter
  ): Promise<StreamEvent> {
    return new Promise((resolve, reject) => {
      const timer = timeout ? setTimeout(() => {
        super.off(eventType, handler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout) : null;

      const handler = (event: StreamEvent) => {
        if (!filter || filter(event)) {
          if (timer) clearTimeout(timer);
          resolve(event);
        }
      };

      super.once(eventType, handler);
    });
  }

  /**
   * Replay buffered events to a listener
   */
  replay(listener: EventListener, filter?: EventFilter): void {
    const events = filter 
      ? this.eventBuffer.filter(filter)
      : this.eventBuffer;

    events.forEach(event => {
      try {
        listener(event);
      } catch (error) {
        Logging.log('StreamEventBus', `Error replaying event: ${error}`, 'error');
      }
    });
  }

  /**
   * Get buffered events
   */
  getBuffer(filter?: EventFilter): StreamEvent[] {
    return filter 
      ? this.eventBuffer.filter(filter)
      : [...this.eventBuffer];
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Get event statistics
   */
  getStats(): Record<StreamEventType, number> {
    const stats: Partial<Record<StreamEventType, number>> = {};
    
    this.eventBuffer.forEach(event => {
      stats[event.type] = (stats[event.type] || 0) + 1;
    });

    return stats as Record<StreamEventType, number>;
  }

  /**
   * Helper methods for common event patterns
   */
  
  emitSegmentStart(segmentId: number, messageId: string, source?: string): void {
    this.emitStreamEvent({
      type: 'segment.start',
      source,
      data: { segmentId, messageId }
    });
  }

  emitSegmentChunk(segmentId: number, content: string, messageId: string, source?: string): void {
    this.emitStreamEvent({
      type: 'segment.chunk',
      source,
      data: { segmentId, content, messageId }
    });
  }

  emitSegmentEnd(segmentId: number, finalContent: string, messageId: string, source?: string): void {
    this.emitStreamEvent({
      type: 'segment.end',
      source,
      data: { segmentId, finalContent, messageId }
    });
  }

  emitToolStart(toolData: z.infer<typeof ToolStartDataSchema>, source?: string): void {
    this.emitStreamEvent({
      type: 'tool.start',
      source,
      data: toolData
    });
  }

  emitToolStream(toolName: string, content: string, source?: string): void {
    this.emitStreamEvent({
      type: 'tool.stream',
      source,
      data: { toolName, content }
    });
  }

  emitToolEnd(toolData: z.infer<typeof ToolEndDataSchema>, source?: string): void {
    this.emitStreamEvent({
      type: 'tool.end',
      source,
      data: toolData
    });
  }

  emitSystemMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', source?: string): void {
    this.emitStreamEvent({
      type: 'system.message',
      source,
      data: { message, level }
    });
  }

  emitThinking(message: string, category?: string, source?: string): void {
    this.emitStreamEvent({
      type: 'system.thinking',
      source,
      data: { message, category }
    });
  }

  emitError(error: string, code?: string, fatal: boolean = false, source?: string): void {
    this.emitStreamEvent({
      type: 'system.error',
      source,
      data: { error, code, fatal }
    });
  }

  emitComplete(success: boolean, message?: string, source?: string): void {
    this.emitStreamEvent({
      type: 'system.complete',
      source,
      data: { success, message }
    });
  }

  emitCancel(reason?: string, userInitiated: boolean = true, source?: string): void {
    this.emitStreamEvent({
      type: 'system.cancel',
      source,
      data: { reason, userInitiated }
    });
  }

  emitDebug(message: string, data?: unknown, source?: string): void {
    if (this.debugMode) {
      this.emitStreamEvent({
        type: 'debug.message',
        source,
        data: { message, data }
      });
    }
  }

  // Alias methods for backward compatibility
  emitSystemError(error: string, errorObj?: Error, source?: string): void {
    this.emitError(error, errorObj?.name, false, source);
  }


  /**
   * Private helper methods
   */

  private generateEventId(): string {
    return `evt_${Date.now()}_${++this.eventCounter}`;
  }

  private addToBuffer(event: StreamEvent): void {
    this.eventBuffer.push(event);
    
    // Trim buffer if needed
    while (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }
  }
}

/**
 * Replay buffer for late subscribers
 */
export class ReplayBuffer {
  private buffer: StreamEvent[] = [];
  private maxSize: number;

  constructor(private eventBus: EventBus, maxSize: number = 100) {
    this.maxSize = maxSize;
    
    // Start recording events
    eventBus.on('*', (event: any) => {
      if (event && typeof event === 'object' && 'type' in event) {
        this.buffer.push(event as StreamEvent);
        if (this.buffer.length > this.maxSize) {
          this.buffer.shift();
        }
      }
    });
  }

  /**
   * Replay buffered events to a handler
   */
  replay(handler: (event: StreamEvent) => void): void {
    this.buffer.forEach(event => handler(event));
  }

  /**
   * Get all buffered events
   */
  getEvents(): StreamEvent[] {
    return [...this.buffer];
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
  }
}
