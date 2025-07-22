import { z } from 'zod'

export const AgentEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agent.start'),
    agentName: z.string(),
    task: z.string(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('agent.end'),
    agentName: z.string(),
    result: z.unknown(),
    totalDuration: z.number(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('iteration.start'),
    iterationNumber: z.number(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('iteration.end'),
    iterationNumber: z.number(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('tool.start'),
    toolName: z.string(),
    parameters: z.unknown(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('tool.end'),
    toolName: z.string(),
    result: z.unknown(),
    duration: z.number(),
    success: z.boolean(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('tool.approval'),
    toolName: z.string(),
    approved: z.boolean(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('message.added'),
    message: z.any(),  // Message type
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
    context: z.unknown().optional(),
    timestamp: z.date()
  })
])

export type AgentEvent = z.infer<typeof AgentEventSchema>
export type AgentEventType = AgentEvent['type']
export type EventHandler<T extends AgentEvent = AgentEvent> = (event: T) => void | Promise<void>

export class AgentEventEmitter {
  private handlers: Map<AgentEventType, Set<EventHandler>> = new Map()
  private anyHandlers: Set<EventHandler> = new Set()

  // Subscribe to specific event type
  on<T extends AgentEvent>(
    eventType: T['type'], 
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    
    this.handlers.get(eventType)!.add(handler as EventHandler)
    
    // Return unsubscribe function
    return () => {
      this.off(eventType, handler as EventHandler)
    }
  }

  // Subscribe to all events
  onAny(handler: EventHandler): () => void {
    this.anyHandlers.add(handler)
    
    return () => {
      this.anyHandlers.delete(handler)
    }
  }

  // Unsubscribe from event
  off(eventType: AgentEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.handlers.delete(eventType)
      }
    }
  }

  // Emit an event
  async emit(event: AgentEvent): Promise<void> {
    // Validate event
    const validatedEvent = AgentEventSchema.parse(event)
    
    // Call specific handlers
    const specificHandlers = this.handlers.get(validatedEvent.type)
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        try {
          await handler(validatedEvent)
        } catch (error) {
          console.error(`Error in event handler for ${validatedEvent.type}:`, error)
        }
      }
    }
    
    // Call any handlers
    for (const handler of this.anyHandlers) {
      try {
        await handler(validatedEvent)
      } catch (error) {
        console.error('Error in any event handler:', error)
      }
    }
  }

  // Clear all handlers
  clear(): void {
    this.handlers.clear()
    this.anyHandlers.clear()
  }

  // Get handler count for debugging
  getHandlerCount(eventType?: AgentEventType): number {
    if (eventType) {
      return this.handlers.get(eventType)?.size ?? 0
    }
    
    let total = this.anyHandlers.size
    for (const handlers of this.handlers.values()) {
      total += handlers.size
    }
    return total
  }
}