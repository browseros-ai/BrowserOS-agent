import { BRAINTRUST_API_KEY, BRAINTRUST_PROJECT_NAME } from '@/config';
import { ScoreResult } from './EvalScorer.types';
import { TIME_EFFICIENCY_BUCKETS } from './Evals.config';
import { initLogger } from 'braintrust';

/**
 * Get human-readable time efficiency bucket
 */
function getTimeEfficiencyBucket(durationMs: number): string {
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.perfect) return '⚡ <30s (Perfect)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.exceptional) return '🚀 <1min (Exceptional)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.excellent) return '✨ <2min (Excellent)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.veryGood) return '👍 <3min (Very Good)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.good) return '✅ <4min (Good)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.average) return '📊 <5min (Average)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.belowAverage) return '⚠️ <6min (Below Average)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.poor) return '🐢 <8min (Poor)';
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.veryPoor) return '❌ <10min (Very Poor)';
  return '💀 >10min (Terrible)';
}

/**
 * Simple Braintrust logger that only uploads scores
 * No complex spans, no session management, just scores
 */
export class BraintrustLogger {
  private logger: any = null;
  private initialized: boolean = false;
  
  initialize(): boolean {
    if (this.initialized) return true;
    this.initialized = true;
    
    if (!BRAINTRUST_API_KEY) {
      console.log('%c⚠️ No Braintrust API key, scores won\'t be uploaded', 'color: #ff9900; font-size: 10px');
      return false;
    }
    
    try {
      // Initialize Braintrust logger
      this.logger = initLogger({
        apiKey: BRAINTRUST_API_KEY,
        projectName: BRAINTRUST_PROJECT_NAME
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
    parentSpanId?: string,
    contextMetrics?: {
      messageCount: number;
      totalCharacters: number;
      estimatedTokens: number;
    }
  ): Promise<void> {
    if (!this.logger) {
      const success = this.initialize();
      if (!success) return;
    }
    
    try {
      // Log as a simple traced event with scores
      await this.logger.traced(async (span: any) => {
        span.log({
          input: query,
          output: `Task completed with score: ${score.weightedTotal.toFixed(2)}`,
          scores: {
            // Normalize scores from 1-10 to 0-1 for Braintrust
            goal_completion: (score.goalCompletion - 1) / 9,  // Convert 1-10 to 0-1
            plan_correctness: (score.planCorrectness - 1) / 9,  // Convert 1-10 to 0-1
            error_free_execution: (score.errorFreeExecution - 1) / 9,  // Convert 1-10 to 0-1
            context_efficiency: (score.contextEfficiency - 1) / 9,  // Convert 1-10 to 0-1
            weighted_total: (score.weightedTotal - 1) / 9  // Convert 1-10 to 0-1
          },
          metadata: {
            type: 'evals2_task',
            duration_ms,
            total_duration_seconds: (score.details.totalDurationMs || duration_ms) / 1000,
            
            // Raw scores (1-10 scale) for comparison
            raw_scores: {
              goal_completion: score.goalCompletion,
              plan_correctness: score.planCorrectness,
              error_free_execution: score.errorFreeExecution,
              context_efficiency: score.contextEfficiency,
              weighted_total: score.weightedTotal
            },
            
            // Tool execution details
            tool_execution: {
              total_calls: score.details.toolCalls,
              failed_calls: score.details.failedCalls,
              success_rate: score.details.toolCalls > 0 
                ? ((score.details.toolCalls - score.details.failedCalls) / score.details.toolCalls * 100).toFixed(1) + '%'
                : '0%',
              retries: score.details.retries,
              total_tool_duration_ms: score.details.totalDurationMs || 0,
            },
            
            // Context usage metrics
            context_usage: contextMetrics || {
              messageCount: 0,
              totalCharacters: 0,
              estimatedTokens: 0
            },
            
            // Scoring metadata
            scoring_info: {
              reasoning: score.details.reasoning || 'No reasoning provided',
              scoring_method: score.details.reasoning?.includes('Heuristic') ? 'heuristic' : 'llm',
              time_efficiency_bucket: getTimeEfficiencyBucket(score.details.totalDurationMs || duration_ms)
            },
            
            // Original metadata passed from NxtScape
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
export const braintrustLogger = new BraintrustLogger();
