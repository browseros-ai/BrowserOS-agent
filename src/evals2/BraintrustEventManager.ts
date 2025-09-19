import { ENABLE_EVALS2, BRAINTRUST_API_KEY, BRAINTRUST_PROJECT_NAME } from '@/config';
import { z } from 'zod';
import { initLogger } from 'braintrust';

// Session metadata schema
export const SessionMetadataSchema = z.object({
  sessionId: z.string(),
  task: z.string(),
  timestamp: z.number(),
  agentVersion: z.string().optional()
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

/**
 * Simplified Braintrust event manager that maintains session and parent span tracking
 * Much simpler than the original BraintrustEventCollector but keeps the useful parts
 */
export class BraintrustEventManager {
  private static instance: BraintrustEventManager | null = null;
  private logger: any = null;
  private initialized: boolean = false;
  private enabled: boolean = false;
  private parentSpanId: string | null = null;
  private sessionId: string | null = null;
  private sessionStartTime: number = 0;
  private sessionScores: number[] = [];  // Track task scores for session average
  
  // Singleton pattern
  static getInstance(): BraintrustEventManager {
    if (!BraintrustEventManager.instance) {
      BraintrustEventManager.instance = new BraintrustEventManager();
    }
    return BraintrustEventManager.instance;
  }
  
  private constructor() {}
  
  /**
   * Check if evals2 is enabled
   */
  isEnabled(): boolean {
    if (!this.initialized) {
      this.initialized = true;
      this.enabled = ENABLE_EVALS2 && !!BRAINTRUST_API_KEY;
      if (this.enabled) {
        console.log('%c✓ Evals2 enabled', 'color: #00ff00; font-size: 10px');
      }
    }
    return this.enabled;
  }
  
  /**
   * Initialize Braintrust logger
   */
  private ensureLogger(): boolean {
    if (this.logger) return true;
    
    if (!BRAINTRUST_API_KEY) {
      return false;
    }
    
    try {
      // Initialize Braintrust logger
      this.logger = initLogger({
        apiKey: BRAINTRUST_API_KEY,
        projectName: BRAINTRUST_PROJECT_NAME
      });
      
      return true;
    } catch (error) {
      console.warn('Failed to initialize Braintrust logger:', error);
      return false;
    }
  }
  
  /**
   * Start a new session (parent span for conversation)
   */
  async startSession(metadata: SessionMetadata): Promise<{ parent?: string }> {
    if (!this.isEnabled()) {
      return {};
    }
    
    const hasLogger = this.ensureLogger();
    if (!hasLogger) {
      return {};
    }
    
    try {
      this.sessionId = metadata.sessionId;
      this.sessionStartTime = Date.now();
      this.sessionScores = [];
      
      // Create parent span for the conversation
      const parent = await this.logger.traced(async (span: any) => {
        span.log({
          input: metadata.task,
          metadata: {
            sessionId: metadata.sessionId,
            timestamp: metadata.timestamp,
            agentVersion: metadata.agentVersion,
            type: 'session_start',
            conversation: true
          }
        });
        return await span.export();  // Returns parent span ID
      }, { name: 'agent_session' });
      
      this.parentSpanId = parent || null;
      
      if (this.parentSpanId) {
        console.log('%c✓ Evals2 session initialized', 'color: #00ff00; font-size: 10px');
        console.log(`%c  Session ID: ${this.sessionId}`, 'color: #888; font-size: 10px');
      }
      
      return { parent: this.parentSpanId || undefined };
    } catch (error) {
      console.debug('Failed to start session:', error);
      return {};
    }
  }
  
  /**
   * Add a task score to the session
   */
  addTaskScore(score: number): void {
    if (this.isEnabled() && this.sessionId) {
      this.sessionScores.push(score);
    }
  }
  
  /**
   * End the current session with aggregated scores
   */
  async endSession(reason: string = 'unknown'): Promise<void> {
    if (!this.isEnabled() || !this.sessionId || !this.parentSpanId || !this.logger) {
      return;
    }
    
    try {
      const duration = Date.now() - this.sessionStartTime;
      
      // Calculate average score for session
      const avgScore = this.sessionScores.length > 0
        ? this.sessionScores.reduce((sum, score) => sum + score, 0) / this.sessionScores.length
        : 1.0;
      
      console.log(`%c📈 Session average score: ${avgScore.toFixed(2)} from ${this.sessionScores.length} tasks`, 
        'color: #4caf50; font-weight: bold; font-size: 11px');
      
      // Log session end
      await this.logger.traced(async (span: any) => {
        span.log({
          metadata: {
            type: 'session_end',
            sessionId: this.sessionId,
            reason,
            duration_ms: duration,
            task_count: this.sessionScores.length
          },
          scores: {
            session_average: avgScore
          }
        });
      }, { 
        name: 'session_end',
        parent: this.parentSpanId 
      });
      
      console.log(`%c← Evals2 session ended (${reason})`, 'color: #888; font-size: 10px');
      
      // Clear session state
      this.sessionId = null;
      this.parentSpanId = null;
      this.sessionScores = [];
    } catch (error) {
      console.debug('Failed to end session:', error);
    }
  }
  
  /**
   * Get the current parent span ID for child spans
   */
  getParentSpanId(): string | null {
    return this.parentSpanId;
  }
  
  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  /**
   * Reset the event manager (for testing)
   */
  reset(): void {
    this.sessionId = null;
    this.parentSpanId = null;
    this.sessionScores = [];
    this.sessionStartTime = 0;
    this.logger = null;
    this.initialized = false;
    this.enabled = false;
  }
  
  /**
   * Flush any pending logs
   */
  async flush(): Promise<void> {
    if (this.logger && this.logger.flush) {
      await this.logger.flush();
    }
  }
}
