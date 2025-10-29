import { BaseMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { getLLM } from '@/lib/llm/LangChainProvider';
import { SCORE_WEIGHTS, GEMINI_SCORING_CONFIG, TIME_EFFICIENCY_BUCKETS } from './Evals.config';
import { ScoreResult, ToolExecution } from './EvalScorer.types';
import { GOOGLE_GENAI_API_KEY, GEMINI_API_KEY } from '@/config';
import { 
  getGoalCompletionPrompt, 
  getPlanEfficiencyPrompt, 
  getErrorHandlingPrompt, 
  getContextEfficiencyPrompt 
} from './EvalScorer.prompt';

export class EvalsScorer {
  private llm: BaseChatModel | null | undefined = undefined;
  
  constructor() {
    // Gemini 2.5 Pro is hardcoded, no model parameter needed
  }
  
  private async getLLM(): Promise<BaseChatModel | null> {
    // If llm is explicitly set to null (for testing), return null
    if (this.llm === null) {
      return null;
    }
    
    if (this.llm === undefined) {
      // Always require Gemini 2.5 Pro - no fallbacks
      const apiKey = GOOGLE_GENAI_API_KEY || GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is required for evals2 scoring. Set GOOGLE_GENAI_API_KEY or GEMINI_API_KEY environment variable.');
      }
      
      try {
        // Directly instantiate Gemini 2.5 Pro
        this.llm = new ChatGoogleGenerativeAI({
          model: GEMINI_SCORING_CONFIG.modelId,
          temperature: GEMINI_SCORING_CONFIG.temperature,
          maxOutputTokens: GEMINI_SCORING_CONFIG.maxTokens,
          apiKey: apiKey,
          convertSystemMessageToHumanContent: true
        });
      } catch (error) {
        console.error('Failed to initialize Gemini 2.5 Pro for scoring:', error);
        throw error; // Re-throw to fail fast
      }
    }
    return this.llm;
  }
  
  /**
   * Score task completion from message history
   */
  async scoreFromMessages(
    messages: BaseMessage[], 
    query: string,
    toolMetrics?: Map<string, any>,
    actualDurationMs?: number  // Actual task execution duration
  ): Promise<ScoreResult> {
    // Extract tool calls with metrics
    const toolCalls = this.extractToolCalls(messages, toolMetrics);
    const toolExecutionMs = this.getTotalDuration(toolCalls);
    // Use actual duration if provided, otherwise fall back to tool execution sum
    const totalDurationMs = actualDurationMs || toolExecutionMs;
    
    try {
      // Get LLM for scoring - this will throw if no API key
      const llm = await this.getLLM();
      
      if (!llm) {
        // Only use heuristic if explicitly set to null for testing
        return this.getHeuristicScores(messages, toolCalls, totalDurationMs, toolExecutionMs, query);
      }
      
      // Score each dimension separately with focused prompts
      const [goalScore, planScore, errorScore, contextScore] = await Promise.all([
        this.scoreGoalCompletion(llm, query, messages, toolCalls),
        this.scorePlanEfficiency(llm, query, toolCalls, totalDurationMs, messages),
        this.scoreErrorHandling(llm, toolCalls, messages),
        this.scoreContextEfficiency(llm, messages, toolCalls)
      ]);
      
      // Calculate weighted total (1-10 scale)
      const weightedTotal = 
        goalScore * SCORE_WEIGHTS.goalCompletion +
        planScore * SCORE_WEIGHTS.planCorrectness +
        errorScore * SCORE_WEIGHTS.errorFreeExecution +
        contextScore * SCORE_WEIGHTS.contextEfficiency;
      
      return {
        goalCompletion: goalScore,
        planCorrectness: planScore,
        errorFreeExecution: errorScore,
        contextEfficiency: contextScore,
        weightedTotal: Math.round(weightedTotal),
        details: {
          toolCalls: toolCalls.length,
          failedCalls: toolCalls.filter(t => !t.success).length,
          retries: this.countRetries(toolCalls),
          totalDurationMs,
          toolExecutionMs,  // Keep tool execution time separate
          reasoning: `Scored with individual LLM calls: ${toolCalls.length} tools, actual: ${totalDurationMs}ms, tools: ${toolExecutionMs}ms`
        }
      };
    } catch (error) {
      // If getLLM throws (no API key), let it bubble up
      // Don't fall back to heuristics for configuration errors
      if (error instanceof Error && error.message.includes('API key is required')) {
        throw error;
      }
      // For other scoring errors, we can still use heuristics
      console.error('LLM scoring failed:', error);
      return this.getHeuristicScores(messages, toolCalls, totalDurationMs, toolExecutionMs, query);
    }
  }
  
  /**
   * Extract tool calls from message history
   * @param messages - Message history from MessageManager
   * @param toolMetrics - Optional metrics Map from ExecutionContext
   */
  private extractToolCalls(messages: BaseMessage[], toolMetrics?: Map<string, any>): ToolExecution[] {
    const toolCalls: ToolExecution[] = [];
    
    // Simple iteration using instanceof
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // Check if it's an AIMessage with tool calls
      if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          // Find the next ToolMessage with matching ID
          const toolMsg = messages.slice(i + 1).find(
            m => m instanceof ToolMessage && m.tool_call_id === (toolCall.id || '')
          ) as ToolMessage | undefined;
          
          // Get metrics from ExecutionContext if available
          const metrics = toolMetrics?.get(toolCall.id || '');
          
          let success = true;
          let error: string | undefined;
          
          if (toolMsg) {
            // Parse tool result to check success
            try {
              const result = JSON.parse(toolMsg.content as string);
              success = result.ok !== false;
              error = result.error;
            } catch {
              // Not JSON, assume success
            }
          }
          
          toolCalls.push({
            toolName: toolCall.name,
            duration: metrics?.duration || 100,  // Use tracked duration or default
            success: metrics?.success ?? success,
            timestamp: metrics?.timestamp || Date.now(),
            args: toolCall.args,
            error: metrics?.error || error
          });
        }
      }
    }
    
    return toolCalls;
  }
  private countRetries(toolCalls: ToolExecution[]): number {
    let retries = 0;
    for (let i = 1; i < toolCalls.length; i++) {
      // Same tool called consecutively = likely retry
      if (toolCalls[i].toolName === toolCalls[i-1].toolName) {
        retries++;
      }
    }
    return retries;
  }
  
  /**
   * Calculate total duration from tool metrics
   */
  private getTotalDuration(toolCalls: ToolExecution[]): number {
    return toolCalls.reduce((sum, tool) => sum + (tool.duration || 0), 0);
  }
  
  /**
   * Score efficiency based on execution time
   * NTN: Direct 10-point scale, no conversion needed
   */
  /**
   * Score goal completion using focused prompt
   */
  private async scoreGoalCompletion(
    llm: BaseChatModel,
    query: string,
    messages: BaseMessage[],
    toolCalls: ToolExecution[]
  ): Promise<number> {
    const prompt = getGoalCompletionPrompt(query, messages, toolCalls);
    return this.invokeLLMForScore(llm, prompt, 'goal completion');
  }
  
  /**
   * Score plan efficiency using focused prompt
   */
  private async scorePlanEfficiency(
    llm: BaseChatModel,
    query: string,
    toolCalls: ToolExecution[],
    totalDurationMs: number,
    messages?: BaseMessage[]
  ): Promise<number> {
    const prompt = getPlanEfficiencyPrompt(query, toolCalls, totalDurationMs, messages);
    return this.invokeLLMForScore(llm, prompt, 'plan efficiency');
  }
  
  /**
   * Score error handling using focused prompt
   */
  private async scoreErrorHandling(
    llm: BaseChatModel,
    toolCalls: ToolExecution[],
    messages?: BaseMessage[]
  ): Promise<number> {
    const prompt = getErrorHandlingPrompt(toolCalls, messages);
    return this.invokeLLMForScore(llm, prompt, 'error handling');
  }
  
  /**
   * Score context efficiency using focused prompt
   */
  private async scoreContextEfficiency(
    llm: BaseChatModel,
    messages: BaseMessage[],
    toolCalls: ToolExecution[]
  ): Promise<number> {
    const prompt = getContextEfficiencyPrompt(messages, toolCalls);
    return this.invokeLLMForScore(llm, prompt, 'context efficiency');
  }
  
  /**
   * Invoke LLM and parse score response
   */
  private async invokeLLMForScore(
    llm: BaseChatModel,
    prompt: string,
    dimension: string
  ): Promise<number> {
    try {
      const response = await llm.invoke(prompt);
      let content = typeof response.content === 'string' ? response.content : '5';
      
      // Clean up any formatting
      content = content.trim().replace(/[^0-9.]/g, '');
      
      const score = parseFloat(content);
      const validScore = Math.min(10, Math.max(1, isNaN(score) ? 5 : score));
      
      console.log(`Scored ${dimension}: ${validScore}`);
      return validScore;
    } catch (error) {
      console.error(`Failed to score ${dimension}:`, error);
      return 5; // Default middle score on error
    }
  }
  
  private scoreTimeEfficiency(durationMs: number): number {
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.perfect) return 10;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.exceptional) return 9;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.excellent) return 8;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.veryGood) return 7;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.good) return 6;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.average) return 5;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.belowAverage) return 4;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.poor) return 3;
    if (durationMs <= TIME_EFFICIENCY_BUCKETS.veryPoor) return 2;
    return 1;
  }
  
  /**
   * Heuristic scoring fallback when LLM is unavailable
   * NTN: Returns 1-10 scores based on simple heuristics
   */
  private getHeuristicScores(
    messages: BaseMessage[],
    toolCalls: ToolExecution[],
    totalDurationMs: number,
    toolExecutionMs: number,
    query: string
  ): ScoreResult {
    // Goal completion heuristic
    const hasDone = messages.some(msg => 
      msg instanceof AIMessage && 
      msg.tool_calls?.some(tc => tc.name === 'done_tool')
    );
    const goalScore = hasDone ? 7 : 3;
    
    // Plan efficiency based on time
    const planScore = this.scoreTimeEfficiency(totalDurationMs);
    
    // Error handling based on failure rate
    const failureRate = toolCalls.filter(t => !t.success).length / Math.max(1, toolCalls.length);
    const errorScore = Math.round(10 * (1 - failureRate));
    
    // Context efficiency based on message count
    const messageCount = messages.length;
    let contextScore = 5;
    if (messageCount < 10) contextScore = 9;
    else if (messageCount < 20) contextScore = 7;
    else if (messageCount < 30) contextScore = 5;
    else if (messageCount < 50) contextScore = 3;
    else contextScore = 2;
    
    const weightedTotal = 
      goalScore * SCORE_WEIGHTS.goalCompletion +
      planScore * SCORE_WEIGHTS.planCorrectness +
      errorScore * SCORE_WEIGHTS.errorFreeExecution +
      contextScore * SCORE_WEIGHTS.contextEfficiency;
    
    return {
      goalCompletion: goalScore,
      planCorrectness: planScore,
      errorFreeExecution: errorScore,
      contextEfficiency: contextScore,
      weightedTotal: Math.round(weightedTotal),
      details: {
        toolCalls: toolCalls.length,
        failedCalls: toolCalls.filter(t => !t.success).length,
        retries: this.countRetries(toolCalls),
        totalDurationMs,
        toolExecutionMs,  // Keep tool execution time separate
        reasoning: 'Heuristic scoring (LLM unavailable)'
      }
    };
  }
}