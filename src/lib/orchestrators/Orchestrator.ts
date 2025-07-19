import { z } from 'zod';
import { AgentGraph, createInitialState, AgentGraphStateType } from '@/lib/graph';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { StreamEventBus } from '@/lib/events';
import { Logging } from '@/lib/utils/Logging';
import { BrowserContext } from '@/lib/browser/BrowserContext';
import { profileStart, profileEnd, profileAsync } from '@/lib/utils/Profiler';

/**
 * Schema for orchestrator execution result
 */
export const OrchestratorResultSchema = z.object({
  success: z.boolean(),  // Whether execution succeeded
  taskType: z.enum(['productivity', 'browse', 'answer']).optional(),  // Classified task type
  finalState: z.any(),  // Final AgentGraphStateType
  error: z.string().optional(),  // Error message if failed
  cancelled: z.boolean().optional(),  // Whether task was cancelled
  duration: z.number(),  // Execution duration in ms
  debugInfo: z.object({
    stepCount: z.number(),  // Number of execution steps
    executionTrace: z.array(z.object({
      step: z.number(),  // Step number
      type: z.string(),  // Message type
      role: z.string(),  // Message role
      content: z.any().optional(),  // Message content
      toolCalls: z.array(z.any()).optional(),  // Tool calls
      toolCallId: z.string().optional()  // Tool call ID
    }))
  }).optional()  // Debug information
});

export type OrchestratorResult = z.infer<typeof OrchestratorResultSchema>;

/**
 * Core orchestration engine for agent graph execution.
 * Handles LangGraph compilation, streaming events, and result processing.
 */
export class Orchestrator {
  private agentGraph: AgentGraph;
  private executionContext: ExecutionContext;
  private initialized: boolean = false;

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.agentGraph = new AgentGraph(executionContext);
  }
  
  /**
   * Initialize the orchestrator and its agent graph
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await profileAsync('Orchestrator.initialize', async () => {
        await this.agentGraph.initialize();
        this.initialized = true;
        Logging.log('Orchestrator', '✅ Orchestrator and AgentGraph initialized');
      });
    }
  }

  /**
   * Execute a query using the agent graph
   * @param query - The user query to execute
   * @param eventBus - EventBus for streaming updates
   * @param abortSignal - Optional abort signal for cancellation
   * @param browserContext - Optional browser context for configuration updates
   * @param followUpContext - Optional context for follow-up tasks
   * @returns Orchestrator execution result
   */
  public async execute(
    query: string,
    eventBus: StreamEventBus,
    abortSignal?: AbortSignal,
    browserContext?: BrowserContext,
    followUpContext?: {
      isFollowUp: boolean;
      previousTaskType: 'productivity' | 'browse' | 'answer' | null;
      previousPlan: string[] | null;
      previousQuery: string | null;
    } | null
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    profileStart('Orchestrator.execute');
    
    try {
      // Ensure orchestrator and agents are initialized
      await this.ensureInitialized();
      
      // Compile the agent graph
      profileStart('Orchestrator.compileGraph');
      const compiledGraph = this.agentGraph.compile();
      profileEnd('Orchestrator.compileGraph');
      
      // Create initial state with follow-up context
      const initialState = createInitialState(query, followUpContext);
      
      Logging.log('Orchestrator', 
        followUpContext?.isFollowUp 
          ? `🔄 Continuing conversation (previous: ${followUpContext.previousTaskType})` 
          : `🚀 Starting new task`
      );
      
      // Note: We'll show follow-up message after classification if task types match
      // This is handled in the event processing below
      
      // Execute the graph with streaming and pass eventBus through config
      profileStart('Orchestrator.streamEvents');
      const eventStream = await compiledGraph.streamEvents(
        initialState,
        {
          version: "v2",
          signal: abortSignal,
          configurable: {
            // EventBus is now accessed through ExecutionContext in each agent
          }
        }
      );
      profileEnd('Orchestrator.streamEvents');
      
      let finalState: AgentGraphStateType = initialState;
      let wasCancelled = false;
      
      // Process streaming events
      profileStart('Orchestrator.processEvents');
      try {
        for await (const event of eventStream) {
          // Check for cancellation
          if (abortSignal?.aborted) {
            wasCancelled = true;
            break;
          }
          
          // Process graph events (capture state updates from any node)
          if (event.event === 'on_chain_end') {
            if (event.name === '__end__') {
              // Merge __end__ output with existing state to preserve taskType and other fields
              if (event.data.output && typeof event.data.output === 'object') {
                finalState = { ...finalState, ...event.data.output };
              }
              Logging.log('Orchestrator', `🔚 End node final state - taskType: ${finalState.taskType}`);
            } else if (event.name === 'classify' || event.name === 'productivity' || event.name === 'answer' ||
                      event.name === 'planner' || event.name === 'browse' || event.name === 'validate') {
              // Update finalState with partial results from each node
              const nodeOutput = event.data?.output;
              if (nodeOutput && typeof nodeOutput === 'object') {
                finalState = { ...finalState, ...nodeOutput };
                Logging.log('Orchestrator', `🔄 Updated state from ${event.name} - taskType: ${finalState.taskType}, hasClassification: ${!!finalState.classificationResult}, hasProductivity: ${!!finalState.productivityResult}, hasAnswer: ${!!finalState.answerResult}`);
                
                // Store the agent type immediately after classification
                if (event.name === 'classify' && finalState.taskType) {
                  this.executionContext.messageManager.setPreviousTaskType(finalState.taskType);
                  Logging.log('Orchestrator', `📌 Stored task type '${finalState.taskType}' for future reference`);
                }
              }
            }
          }
          
          // Emit system messages for node starts
          if (event.event === 'on_chain_start') {
            const nodeName = event.name;
            if (nodeName === 'classify') {
              eventBus.emitThinking('🤔 Analyzing task type', 'info', 'Orchestrator');
            } else if (nodeName === 'productivity') {
              // Show follow-up message if this is a continuing productivity task
              if (followUpContext?.isFollowUp && finalState.isFollowUp !== false && 
                  followUpContext.previousTaskType === 'productivity') {
                eventBus.emitSystemMessage("💡 I'll continue based on our previous conversation. To start a completely new task, use the refresh 🔄 button to clear the history.", 'info', 'Orchestrator');
              }
              eventBus.emitThinking('🚀 Executing productivity task', 'info', 'Orchestrator');
            } else if (nodeName === 'answer') {
              // Show follow-up message if this is a continuing answer task
              if (followUpContext?.isFollowUp && finalState.isFollowUp !== false && 
                  followUpContext.previousTaskType === 'answer') {
                eventBus.emitThinking("💡 I'll continue based on our previous conversation. To start a completely new task, use the refresh 🔄 button to clear the history.", 'info', 'Orchestrator');
              }
              eventBus.emitThinking('🎯 Analyzing and answering your question', 'info', 'Orchestrator');
            } else if (nodeName === 'planner') {
              // Show follow-up message if this is a continuing browse task
              if (followUpContext?.isFollowUp && finalState.isFollowUp !== false && 
                  followUpContext.previousTaskType === 'browse') {
                eventBus.emitSystemMessage("💡 I'll continue based on our previous conversation. To start a completely new task, use the refresh 🔄 button to clear the history.", 'info', 'Orchestrator');
              }
              eventBus.emitThinking('🎯 Planning browse task', 'info', 'Orchestrator');
            } else if (nodeName === 'browse') {
              eventBus.emitThinking(`🌐 Executing step ${finalState.currentStepIndex + 1}/${finalState.plan.length}`, 'info', 'Orchestrator');
            } else if (nodeName === 'validate') {
              eventBus.emitThinking('🔍 Validating results', 'info', 'Orchestrator');
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          wasCancelled = true;
          Logging.log('Orchestrator', 'Task was cancelled by user', 'info');
        } else {
          throw error;
        }
      } finally {
        profileEnd('Orchestrator.processEvents');
        
        // Cleanup all agents after execution
        try {
          await this.agentGraph.cleanup();
          Logging.log('Orchestrator', '🧹 Agent cleanup completed');
        } catch (cleanupError) {
          const cleanupErrorMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
          Logging.log('Orchestrator', `⚠️ Agent cleanup failed: ${cleanupErrorMsg}`, 'warning');
          // Don't throw cleanup errors - we still want to return the result
        }
      }
      
      // Handle cancellation - only show message for user-initiated cancellation
      if (wasCancelled) {
        if (this.executionContext.isUserCancellation()) {
          eventBus.emitCancel('User requested cancellation', true, 'Orchestrator');
          eventBus.emitSystemMessage(`✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!`, 'info', 'Orchestrator');
        } else {
          eventBus.emitCancel('Internal cancellation', false, 'Orchestrator');
        }
        
        const duration = Date.now() - startTime;
        profileEnd('Orchestrator.execute');
        return {
          success: false,
          finalState: finalState,
          error: 'Task stopped by user',
          cancelled: true,
          duration
        };
      } 
      
      // Debug: Log final state to understand what's happening
      Logging.log('Orchestrator', `📊 Final state - taskType: ${finalState.taskType}, hasClassification: ${!!finalState.classificationResult}, hasProductivity: ${!!finalState.productivityResult}, hasAnswer: ${!!finalState.answerResult}, hasValidation: ${!!finalState.validationResult}`);
      
      // Determine success based on task type
      let isSuccess = false;
      let resultMessage = '';
      
      if (finalState.taskType === 'productivity') {
        isSuccess = finalState.productivityResult?.completed || false;
        resultMessage = finalState.productivityResult?.result || 'Productivity task completed';
      } else if (finalState.taskType === 'browse') {
        // For browse tasks, check validation result
        isSuccess = finalState.validationResult?.is_valid || false;
        resultMessage = finalState.validationResult?.reasoning || 'Browse task completed';
      } else if (finalState.taskType === 'answer') {
        // For answer tasks, use the success flag directly
        isSuccess = finalState.answerResult?.success || false;
        // For answer tasks, don't include the answer text since it was already streamed to UI
        resultMessage = isSuccess
          ? 'Answer provided successfully'
          : 'Failed to generate answer';
      } else {
        // For unclassified or other task types, check if we have any result
        if (finalState.productivityResult) {
          isSuccess = finalState.productivityResult.completed || false;
          resultMessage = finalState.productivityResult.result || 'Task completed';
        } else if (finalState.validationResult) {
          isSuccess = finalState.validationResult.is_valid || false;
          resultMessage = finalState.validationResult.reasoning || 'Task completed';
        } else {
          isSuccess = false;
          resultMessage = 'Task completed without clear result';
        }
      }
      
      // Send completion event
      eventBus.emitComplete(isSuccess, isSuccess ? '✅ Task completed successfully' : `❌ Task failed: ${resultMessage}`, 'Orchestrator');

      const duration = Date.now() - startTime;
      Logging.log(
        "Orchestrator",
        `LangGraph execution completed in ${duration}ms - ${
          isSuccess ? "SUCCESS" : "FAILED"
        }`
      );
      
      // Create and return result
      profileEnd('Orchestrator.execute');
      return {
        success: isSuccess,
        taskType: finalState.taskType,
        finalState: finalState,
        error: isSuccess ? undefined : resultMessage,
        duration,
        debugInfo: this.createDebugInfo(finalState)
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;
      
      Logging.log('Orchestrator', `Execution error: ${errorMessage}`, 'error');
      
      // Attempt cleanup even on error
      try {
        await this.agentGraph.cleanup();
        Logging.log('Orchestrator', '🧹 Agent cleanup completed after error');
      } catch (cleanupError) {
        const cleanupErrorMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        Logging.log('Orchestrator', `⚠️ Agent cleanup failed after error: ${cleanupErrorMsg}`, 'warning');
      }
      
      profileEnd('Orchestrator.execute');
      return {
        success: false,
        finalState: {} as AgentGraphStateType,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Creates debug information from agent result
   * @param finalState - The final graph state
   * @returns Debug information if available
   */
  private createDebugInfo(finalState: AgentGraphStateType): OrchestratorResult['debugInfo'] | undefined {
    // Since we're using graph state instead of agent result with messages,
    // we'll create a simplified debug info based on what's available
    const stepCount = finalState.currentStepIndex || 0;
    
    if (stepCount === 0 && !finalState.classificationResult) {
      return undefined;
    }

    const executionTrace = [];
    let step = 1;

    // Add classification step if available
    if (finalState.classificationResult) {
      executionTrace.push({
        step: step++,
        type: 'Classification',
        role: 'system',
        content: {
          taskType: finalState.classificationResult.task_type
        }
      });
    }

    // Add productivity result if available
    if (finalState.productivityResult) {
      executionTrace.push({
        step: step++,
        type: 'ProductivityAgent',
        role: 'assistant',
        content: {
          completed: finalState.productivityResult.completed,
          result: finalState.productivityResult.result,
          data: finalState.productivityResult.data
        }
      });
    }

    // Add planner result if available
    if (finalState.planResult) {
      executionTrace.push({
        step: step++,
        type: 'PlannerAgent',
        role: 'system',
        content: {
          plan: finalState.planResult.plan,
          reasoning: finalState.planResult.reasoning
        }
      });
    }

    // Add browse results if available
    if (finalState.stepResults && finalState.stepResults.length > 0) {
      finalState.stepResults.forEach((result: any, index: number) => {
        executionTrace.push({
          step: step++,
          type: 'BrowseAgent',
          role: 'assistant',
          content: {
            stepIndex: index,
            completed: result.completed,
            actions: result.actions_taken,
            finalState: result.final_state
          }
        });
      });
    }

    // Add validation result if available
    if (finalState.validationResult) {
      executionTrace.push({
        step: step++,
        type: 'ValidatorAgent',
        role: 'system',
        content: {
          isValid: finalState.validationResult.is_valid,
          reasoning: finalState.validationResult.reasoning,
          confidence: finalState.validationResult.confidence
        }
      });
    }

    return {
      stepCount: executionTrace.length,
      executionTrace
    };
  }
}
