import { z } from 'zod'
import { BrowserContext } from '@/lib/browser/BrowserContext'

export const AgentContextSchema = z.object({
  sessionId: z.string(),  // Unique session identifier
  userId: z.string().optional(),  // User identifier
  browserContext: z.any().optional(),  // Browser context reference
  selectedTabs: z.array(z.number()).optional(),  // Active tab IDs
  metadata: z.record(z.unknown()).optional(),  // Custom metadata
  startTime: z.date(),  // Execution start time
  iterationCount: z.number().default(0)  // Current iteration
})

export type AgentContextData = z.infer<typeof AgentContextSchema>

export class AgentContext {
  private state: Map<string, any> = new Map()
  private data: AgentContextData

  constructor(data: Partial<AgentContextData> = {}) {
    this.data = AgentContextSchema.parse({
      sessionId: data.sessionId ?? crypto.randomUUID(),
      startTime: data.startTime ?? new Date(),
      iterationCount: 0,
      ...data
    })
  }

  // State management
  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined
  }

  set(key: string, value: any): void {
    this.state.set(key, value)
  }

  has(key: string): boolean {
    return this.state.has(key)
  }

  delete(key: string): boolean {
    return this.state.delete(key)
  }

  increment(key: string): number {
    const current = this.get<number>(key) ?? 0
    const newValue = current + 1
    this.set(key, newValue)
    return newValue
  }

  // Context data accessors
  getSessionId(): string {
    return this.data.sessionId
  }

  getUserId(): string | undefined {
    return this.data.userId
  }

  getMetadata(): Record<string, unknown> {
    return this.data.metadata ?? {}
  }

  setMetadata(key: string, value: unknown): void {
    if (!this.data.metadata) {
      this.data.metadata = {}
    }
    this.data.metadata[key] = value
  }

  // Browser-specific helpers
  getBrowserContext(): BrowserContext | undefined {
    return this.data.browserContext
  }

  setBrowserContext(context: BrowserContext): void {
    this.data.browserContext = context
  }

  getSelectedTabs(): number[] {
    return this.data.selectedTabs ?? []
  }

  setSelectedTabs(tabs: number[]): void {
    this.data.selectedTabs = tabs
  }

  // Iteration tracking
  getIterationCount(): number {
    return this.data.iterationCount
  }

  incrementIteration(): number {
    this.data.iterationCount++
    return this.data.iterationCount
  }

  // Timing
  getStartTime(): Date {
    return this.data.startTime
  }

  getElapsedTime(): number {
    return Date.now() - this.data.startTime.getTime()
  }

  // Serialization
  toJSON(): AgentContextData {
    return {
      ...this.data,
      metadata: {
        ...this.data.metadata,
        state: Object.fromEntries(this.state)
      }
    }
  }
}