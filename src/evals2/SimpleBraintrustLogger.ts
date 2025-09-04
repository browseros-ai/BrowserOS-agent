import { BRAINTRUST_API_KEY } from '@/config';
import { ScoreResult } from './types';

// Lazy load Braintrust to avoid module loading issues
let initLogger: any = null;

/**
 * Simple Braintrust logger that only uploads scores
 * No complex spans, no session management, just scores
 */
export class SimpleBraintrustLogger {
  private logger: any = null;
  private initialized: boolean = false;
  
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    this.initialized = true;
    
    if (!BRAINTRUST_API_KEY) {
      console.log('%c⚠️ No Braintrust API key, scores won\'t be uploaded', 'color: #ff9900; font-size: 10px');
      return false;
    }
    
    try {
      // Lazy load braintrust module
      if (!initLogger) {
        const braintrust = require('braintrust');
        initLogger = braintrust.initLogger;
      }
      
      // Initialize simple logger (not experiment)
      this.logger = initLogger({
        apiKey: BRAINTRUST_API_KEY,
        projectName: 'browseros-agent-online'
      });
      
      console.log('%c✓ Braintrust logger initialized', 'color: #00ff00; font-size: 10px');
      return true;
    } catch (error) {
      console.warn('Failed to initialize Braintrust:', error);
      return false;
    }
  }
  
  async logTaskScore(
    query: string,
    score: ScoreResult,
    duration_ms: number,
    metadata?: any,
    parentSpanId?: string
  ): Promise<void> {
    if (!this.logger) {
      const success = await this.initialize();
      if (!success) return;
    }
    
    try {
      // Log as a simple traced event with scores
      await this.logger.traced(async (span: any) => {
        span.log({
          input: query,
          output: `Task completed with score: ${score.weightedTotal.toFixed(2)}`,
          scores: {
            // Our 4 simplified scores
            goal_completion: score.goalCompletion,
            plan_correctness: score.planCorrectness,
            error_free_execution: score.errorFreeExecution,
            context_efficiency: score.contextEfficiency,
            weighted_total: score.weightedTotal
          },
          metadata: {
            type: 'evals2_task',
            duration_ms,
            tool_calls: score.details.toolCalls,
            failed_calls: score.details.failedCalls,
            retries: score.details.retries,
            ...metadata
          }
        });
      }, {
        name: 'evals2_task_score',
        parent: parentSpanId  // Use parent span if provided
      });
      
      console.log('%c📊 Scores uploaded to Braintrust', 'color: #4caf50; font-size: 10px');
    } catch (error) {
      // Silent failure - don't break execution
      console.debug('Failed to log to Braintrust:', error);
    }
  }
  
  async flush(): Promise<void> {
    if (this.logger && this.logger.flush) {
      await this.logger.flush();
    }
  }
}

// Export singleton instance
export const braintrustLogger = new SimpleBraintrustLogger();