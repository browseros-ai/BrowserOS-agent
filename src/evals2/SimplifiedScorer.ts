import { BaseMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getLLM } from '@/lib/llm/LangChainProvider';
import { SCORE_WEIGHTS, DEFAULT_SCORING_MODEL } from './config';
import { ScoreResult, ToolExecution } from './types';

export class SimplifiedScorer {
  private model: string;
  private llm: BaseChatModel | null = null;
  
  constructor(model?: string) {
    this.model = model || process.env.OPENAI_MODEL_FOR_SCORING || DEFAULT_SCORING_MODEL;
  }
  
  private async getLLM(): Promise<BaseChatModel | null> {
    if (!this.llm) {
      try {
        this.llm = await getLLM({ temperature: 0, maxTokens: 100 });
      } catch {
        return null;
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
    toolMetrics?: Map<string, any>
  ): Promise<ScoreResult> {
    // Extract tool calls from messages
    const toolCalls = this.extractToolCalls(messages, toolMetrics);
    
    // Calculate individual scores
    const goalScore = await this.scoreGoalCompletion(messages, query);
    const planScore = await this.scorePlanCorrectness(toolCalls, query);
    const errorScore = this.scoreErrorFreeExecution(toolCalls);
    const contextScore = this.scoreContextEfficiency(messages, toolCalls);
    
    // Calculate weighted total
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
      weightedTotal,
      details: {
        toolCalls: toolCalls.length,
        failedCalls: toolCalls.filter(t => !t.success).length,
        retries: this.countRetries(toolCalls),
        reasoning: `Scored ${toolCalls.length} tool calls for query: ${query}`
      }
    };
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
  
  private async scoreGoalCompletion(messages: BaseMessage[], query: string): Promise<number> {
    const llm = await this.getLLM();
    if (!llm) {
      // Simple heuristic: check if done_tool was called
      const hasDone = messages.some(msg => 
        msg instanceof AIMessage && 
        msg.tool_calls?.some(tc => tc.name === 'done_tool')
      );
      return hasDone ? 0.8 : 0.3;
    }
    
    // Simple prompt for LLM scoring
    const lastMessages = messages.slice(-5);
    const prompt = `Task: "${query}"

Last 5 messages:
${lastMessages.map(m => `${m.constructor.name}: ${typeof m.content === 'string' ? m.content.slice(0, 100) : '...'}`).join('\n')}

Score task completion (0-1):
1 = fully completed
0.5 = partial  
0 = not done

Reply with ONLY a number:`;

    try {
      const response = await llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : '0.5';
      const score = parseFloat(content.trim());
      return Math.min(1, Math.max(0, isNaN(score) ? 0.5 : score));
    } catch {
      return 0.5;
    }
  }
  
  private async scorePlanCorrectness(toolCalls: ToolExecution[], query: string): Promise<number> {
    const llm = await this.getLLM();
    if (!llm) {
      // Simple heuristic based on tool count and pattern
      if (toolCalls.length === 0) return 0;
      if (toolCalls.length > 20) return 0.3;
      
      const hasPlanning = toolCalls.some(t => 
        t.toolName === 'classification_tool' || 
        t.toolName === 'planner_tool'
      );
      return hasPlanning ? 0.7 : 0.5;
    }
    
    // Simple prompt for plan quality
    const toolSequence = toolCalls.slice(0, 20).map(t => t.toolName).join(' → ');
    const prompt = `Task: "${query}"

Tools: ${toolSequence}

Rate efficiency (0-1):
1 = efficient
0.5 = okay
0 = inefficient

Reply with ONLY a number:`;

    try {
      const response = await llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : '0.5';
      const score = parseFloat(content.trim());
      return Math.min(1, Math.max(0, isNaN(score) ? 0.5 : score));
    } catch {
      return 0.5;
    }
  }
  
  private scoreErrorFreeExecution(toolCalls: ToolExecution[]): number {
    if (toolCalls.length === 0) return 1.0;
    
    const successCount = toolCalls.filter(t => t.success).length;
    const errorCount = toolCalls.filter(t => !t.success).length;
    const retryCount = this.countRetries(toolCalls);
    
    // Simple formula: success ratio minus penalties
    const baseRatio = successCount / toolCalls.length;
    const retryPenalty = retryCount * 0.05;  // 5% per retry
    const errorPenalty = errorCount * 0.10;   // 10% per error
    
    return Math.max(0, baseRatio - retryPenalty - errorPenalty);
  }
  
  private scoreContextEfficiency(messages: BaseMessage[], toolCalls: ToolExecution[]): number {
    // Simple token estimation: ~4 chars per token
    const totalChars = messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return sum + content.length;
    }, 0);
    
    const estimatedTokens = totalChars / 4;
    
    // Simple scoring based on requirements
    if (estimatedTokens <= 32000) return 1.0;   // 5/5
    if (estimatedTokens <= 64000) return 0.8;   // 4/5
    if (estimatedTokens <= 128000) return 0.6;  // 3/5
    if (estimatedTokens <= 256000) return 0.4;  // 2/5
    return 0.2;  // 1/5
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
}