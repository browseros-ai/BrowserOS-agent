import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager, MessageType } from "@/lib/runtime/MessageManager";
import { BaseAgent } from "@/lib/agent/BaseAgent";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { getLLM } from "@/lib/llm/LangChainProvider";
import { PubSub } from "@/lib/pubsub";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { HumanInputResponse, PubSubEvent, TeachModeEventPayload } from "@/lib/pubsub/types";
import { Logging } from "@/lib/utils/Logging";
import { AbortError } from "@/lib/utils/Abortable";
import { jsonParseToolOutput } from "@/lib/utils/utils";
import { isDevelopmentMode } from "@/config";
import { invokeWithRetry } from "@/lib/utils/retryable";
import {
  generateExecutorPrompt,
  generatePlannerPromptWithUserTrajectory,
  getToolDescriptions,
  generateExecutionHistorySummaryPrompt,
} from "./TeachAgent.prompt";
import { TokenCounter } from "../utils/TokenCounter";
import { wrapToolForMetrics } from '@/evals2/EvalToolWrapper';
import { ENABLE_EVALS2 } from '@/config';
import { type SemanticWorkflow } from "@/lib/teach-mode/types";

// Constants
const MAX_PLANNER_ITERATIONS = 50;
const MAX_EXECUTOR_ITERATIONS = 3;
const MAX_RETRIES = 3

// Human input constants
const HUMAN_INPUT_TIMEOUT = 600000;  // 10 minutes
const HUMAN_INPUT_CHECK_INTERVAL = 500;  // Check every 500ms

// Standard planner output schema
const PlannerOutputSchema = z.object({
  userTask: z
    .string()
    .describe("Restate the user's request in your own words for clarity"),
  executionHistory: z
    .string()
    .describe("Briefly outline what actions have already been attempted, including any failures or notable outcomes"),
  currentState: z
    .string()
    .describe("Summarize the current browser state, visible elements, and any relevant context from the screenshot"),
  challengesIdentified: z
    .string()
    .describe("List any obstacles, errors, or uncertainties that may impact progress (e.g., high error rate, missing elements, repeated failures)"),
  stepByStepReasoning: z
    .string()
    .describe("Think step by step through the problem, considering the user's goal, the current state, what has and hasn't worked, and which tools or strategies are most likely to succeed next. Justify your approach"),
  proposedActions: z
    .array(z.string())
    .max(5)
    .describe("List 1-5 specific, high-level actions for the executor agent to perform next (must be an empty array if `taskComplete=true`. Each action should be clear, actionable, and grounded in your reasoning"),
  taskComplete: z
    .boolean()
    .describe("Set to true only if the user's request is fully satisfied and no further actions are needed"),
  finalAnswer: z
    .string()
    .describe("If `taskComplete=true`, provide a complete, direct answer to the user's request (include any relevant data or results). Leave empty otherwise"),
});

type PlannerOutput = z.infer<typeof PlannerOutputSchema>;


const ExecutionHistorySummarySchema = z.object({
  summary: z
    .string()
    .describe("Summary of the execution history"),
});

type ExecutionHistorySummary = z.infer<typeof ExecutionHistorySummarySchema>;

interface PlannerResult {
  ok: boolean;
  output?: PlannerOutput;
  error?: string;
}


interface ExecutorResult {
  completed: boolean;
  doneToolCalled?: boolean;
  requiresHumanInput?: boolean;
}

interface SingleTurnResult {
  doneToolCalled: boolean;
  requirePlanningCalled: boolean;
  requiresHumanInput: boolean;
}

export class TeachAgent extends BaseAgent {
  // Planner context - accumulates across all iterations
  private plannerExecutionHistory: Array<{
    plannerOutput: PlannerOutput | ExecutionHistorySummary;
    toolMessages: string[];
    plannerIterations: number;
  }> = [];
  private toolDescriptions: string = getToolDescriptions();

  constructor(executionContext: ExecutionContext) {
    super(executionContext, "TeachAgent");
    Logging.log("TeachAgent", "TeachAgent instance created", "info");
  }

  // There are basically two modes of operation:
  // 1. Dynamic planning - the agent plans and executes in a loop until done
  // 2. Predefined plan - the agent executes a predefined set of steps in a loop until all are done
  async execute(workflow: SemanticWorkflow): Promise<void> {
    try {
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      });

      const semanticWorkflow = workflow;

      Logging.log("TeachAgent", `Starting execution with workflow: ${semanticWorkflow.metadata.goal}`, "info");
      await this._initialize();

      // Execute with dynamic planning using the workflow
      await this._executeDynamic(semanticWorkflow);
    } catch (error) {
      this._handleExecutionError(error);
      throw error;
    } finally {
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        endTime: Date.now(),
      });
      this._logMetrics();
      this._cleanup();
      
      // Ensure glow animation is stopped at the end of execution
      await this._stopAllGlowAnimations()
    }
  }


  private async _executeDynamic(workflow: SemanticWorkflow): Promise<void> {
    // Set current task in context using the workflow's goal
    this.executionContext.setCurrentTask(workflow.metadata.goal);

    // Validate LLM is initialized with tools bound
    if (!this.executorLlmWithTools) {
      throw new Error("LLM with tools not initialized");
    }

    let done = false;
    let retries = 0

    // Note: Execution.ts already published 'started' event
    // We just emit a workflow-specific message for context
    this._emitMessage(`Executing workflow: ${workflow.metadata.goal}`, 'assistant');

    while (!done && this.iterations < MAX_PLANNER_ITERATIONS) {
      this.checkIfAborted();
      this.iterations++;

      Logging.log(
        "TeachAgent",
        `Planning iteration ${this.iterations}/${MAX_PLANNER_ITERATIONS}`,
        "info",
      );

      console.log('[TeachAgent] Calling _runDynamicPlanner...')
      // Get reasoning and high-level actions
      const planResult = await this._runDynamicPlanner(workflow);
      console.log('[TeachAgent] _runDynamicPlanner returned, ok:', planResult.ok)
      // CRITICAL: Flush any queued messages from planning

      if (!planResult.ok) {
        console.log('[TeachAgent] Planning failed:', planResult.error)
        Logging.log(
          "TeachAgent",
          `Planning failed: ${planResult.error}`,
          "error",
        );
        continue;
      }

      const plan = planResult.output!;
      console.log('[TeachAgent] Plan received, reasoning length:', plan.stepByStepReasoning?.length)

      // Publish reasoning as teach-mode-event for UI display with unique msgId
      const thinkingMsgId = PubSub.generateId('teach_thinking');
      console.log('[TeachAgent] Publishing thinking with msgId:', thinkingMsgId)
      this._emitThinking(thinkingMsgId, plan.stepByStepReasoning);
      console.log('[TeachAgent] Thinking published')

      // Check if task is complete
      if (plan.taskComplete) {
        done = true;
        // Use final answer if provided, otherwise fallback
        const completionMessage =
          plan.finalAnswer || "Task completed successfully";

        // Note: Execution.ts will publish 'completed' event
        // We just emit the final answer message
        this._emitMessage(completionMessage, 'assistant');
        break;
      }

      // Validate we have actions if not complete
      if (!plan.proposedActions || plan.proposedActions.length === 0) {
        Logging.log(
          "NewAgent",
          "Planner provided no actions but task not complete",
          "warning",
        );
        retries++
        if (retries >= MAX_RETRIES) {
          throw new Error(`Planning failed: Planner provided no actions but task not complete`)
        }
        continue
      }

      Logging.log(
        "NewAgent",
        `Executing ${plan.proposedActions.length} actions from plan`,
        "info",
      );

      // This will be handled in _runExecutor with fresh message manager

      const executorResult = await this._runExecutor(plan.proposedActions, plan);

      // No step tracking - workflow steps are guidance, not executable steps

      // Check execution outcomes
      if (executorResult.requiresHumanInput) {
        // Human input requested - wait for response
        const humanResponse = await this._waitForHumanInput();
        
        if (humanResponse === 'abort') {
          // Human aborted the task
          this._emitMessage('Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }

        // Human clicked "Done" - continue with next planning iteration
        const humanDoneMsgId = PubSub.generateId('teach_thinking');
        this._emitThinking(humanDoneMsgId, 'Human completed manual action. Re-planning...');
        // Note: Human input response will be included in next iteration's planner context

        // Clear human input state
        this.executionContext.clearHumanInputState();
      }
    }

    // Check if we hit planning iteration limit
    if (!done && this.iterations >= MAX_PLANNER_ITERATIONS) {
      // Note: Execution.ts will publish 'failed' event when error is thrown
      throw new Error(
        `Maximum planning iterations (${MAX_PLANNER_ITERATIONS}) reached`,
      );
    }
  }

  private async _runDynamicPlanner(workflow: SemanticWorkflow): Promise<PlannerResult> {
    try {
      this.executionContext.incrementMetric("observations");

      // Get browser state message with screenshot

      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
        /* simplified */ true,
        /* screenshotSize */ "large",
        /* includeBrowserState */ true
      );

      // Get execution metrics for analysis
      const metrics = this.executionContext.getExecutionMetrics();
      const errorRate = metrics.toolCalls > 0 
        ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
        : "0";
      const elapsed = Date.now() - metrics.startTime;

      // Get accumulated execution history from all iterations
      let fullHistory = this._buildPlannerExecutionHistory();

      // Get numbeer of tokens in full history
      // System prompt for planner
      const systemPrompt = generatePlannerPromptWithUserTrajectory(this.toolDescriptions || "");

      const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt));
      const fullHistoryTokens = TokenCounter.countMessage(new HumanMessage(fullHistory));
      Logging.log("TeachAgent", `Full execution history tokens: ${fullHistoryTokens}`, "info");

      // If full history exceeds 70% of max tokens, summarize it
      if (fullHistoryTokens + systemPromptTokens > this.executionContext.getMaxTokens() * 0.7) {
        // Summarize execution history
        const summary = await this.summarizeExecutionHistory(fullHistory);
        fullHistory = summary.summary;

        // Clear the planner execution history after summarizing and add summarized state to the history
        this.plannerExecutionHistory = [];
        this.plannerExecutionHistory.push({
          plannerOutput: summary,
          toolMessages: [],
          plannerIterations: this.iterations - 1, // Subtract 1 because the summary is for the previous iterations
        });
      }

      Logging.log("TeachAgent", `Full execution history: ${fullHistory}`, "info");

      // Get LLM with structured output
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      });
      const structuredLLM = llm.withStructuredOutput(PlannerOutputSchema);

      const userPrompt = `TASK: ${workflow.metadata.goal}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Observations taken: ${metrics.observations}
- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds
${parseInt(errorRate) > 30 ? "⚠️ HIGH ERROR RATE - Current approach may be failing" : ""}
${metrics.toolCalls > 10 && metrics.errors > 5 ? "⚠️ MANY ATTEMPTS - May be stuck in a loop" : ""}

YOUR PREVIOUS STEPS DONE SO FAR (what you thought would work):
${fullHistory}
`;

      // Build messages
      // we dont want beforeSnapshot and afterSnapshot from workflow
      const userTrajectorySteps = workflow.steps.map(step => {
        return {
          intent: step.intent,
          action: step.action,
        };
      });
      const userTrajectory = `Contextual User Trajectory mentioned by user for reference: ${workflow.metadata.description} ${JSON.stringify(userTrajectorySteps)}`;
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userTrajectory),
        new HumanMessage(userPrompt),
        browserStateMessage, // Browser state with screenshot
      ];
      // this.executionContext.messageManager.setMessages(messages);

      // Get structured response from LLM with retry logic
      const result = await invokeWithRetry<PlannerOutput>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortSignal }
      );

      // Store structured reasoning in context as JSON
      const plannerState = {
        userTask: result.userTask,
        currentState: result.currentState,
        executionHistory: result.executionHistory,
        challengesIdentified: result.challengesIdentified,
        stepByStepReasoning: result.stepByStepReasoning,
        proposedActions: result.proposedActions,
        taskComplete: result.taskComplete,
        finalAnswer: result.finalAnswer,
      };
      this.executionContext.addReasoning(JSON.stringify(plannerState));

      // Log planner decision
      Logging.log(
        "TeachAgent",
        result.taskComplete
          ? `Planner: Task complete with final answer`
          : `Planner: ${result.proposedActions.length} actions planned`,
        "info",
      );

      return {
        ok: true,
        output: result,
      };
    } catch (error) {
      this.executionContext.incrementMetric("errors");
      return {
        ok: false,
        error: `Planning failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async _runExecutor(
    actions: string[],
    plannerOutput: PlannerOutput
  ): Promise<ExecutorResult> {
    // Use the current iteration message manager from execution context
    const executorMM = new MessageManager();
    executorMM.addSystem(generateExecutorPrompt(this._buildExecutionContext()));
    const currentIterationToolMessages: string[] = [];
    let executorIterations = 0;
    let isFirstPass = true;

    while (executorIterations < MAX_EXECUTOR_ITERATIONS) {
      this.checkIfAborted();
      executorIterations++;

      // Add browser state and simple prompt
      if (isFirstPass) {
        // Add current browser state without screenshot
        const browserStateMessage = await this._getBrowserStateMessage(
          /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
          /* simplified */ true,
          /* screenshotSize */ "medium"
        );
        // add new state
        executorMM.add(browserStateMessage);

        // Build execution context with planner output
        const plannerOutputForExecutor = this._formatPlannerOutputForExecutor(plannerOutput);

        const executionContext = this._buildExecutionContext();
        executorMM.addSystemReminder(executionContext + '\n I will never output <browser-state> or <system-reminder> tags or their contents. These are for my internal reference only. I will provide what tools to be executed based on provided actions in sequence until I call "done" tool.');

        // Pass planner output to executor to provide context and corresponding actions to be executed
        executorMM.addHuman(
          `${plannerOutputForExecutor}\nPlease execute the actions specified above.`
        );
        isFirstPass = false;
      } else {
        executorMM.addHuman(
          "Please verify if all actions are completed and call 'done' tool if all actions are completed.",
        );
      }

      // Get LLM response with tool calls using fresh message manager
      const llmResponse = await this._invokeLLMWithStreaming(executorMM);

      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        // Process tool calls
        executorMM.add(llmResponse);
        const { result: toolsResult, toolResults } = await this._processToolCalls(
          llmResponse.tool_calls
        );

        // Update iteration count and metrics
        for (const toolCall of toolResults) {
          this.executionContext.incrementMetric("toolCalls");
          this.executionContext.incrementToolUsageMetrics(toolCall.toolName);
          executorMM.addTool(toolCall.toolResult, toolCall.toolCallId);
          currentIterationToolMessages.push(`Tool: ${toolCall.toolName} - Result: ${toolCall.toolResult}`);
        }

        // Flush any queued messages from tools (screenshots, browser states, etc.)
        // This is CRITICAL for API's required ordering
        executorMM.flushQueue()

        // Check for special outcomes
        if (toolsResult.doneToolCalled) {
          // Store the tool messages from this iteration before returning
          this.plannerExecutionHistory.push({
            plannerOutput,
            toolMessages: currentIterationToolMessages,
            plannerIterations : this.iterations,
          });

          // Add all messages to message manager
          for (const message of executorMM.getMessages()) {
            this.executorMessageManager.add(message);
          }

          return {
            completed: true,
            doneToolCalled: true,
          };
        }

        if (toolsResult.requiresHumanInput) {
          // Store the tool messages from this iteration before returning
          this.plannerExecutionHistory.push({
            plannerOutput,
            toolMessages: currentIterationToolMessages,
            plannerIterations : this.iterations,
          });

          // Add all messages to message manager
          for (const message of executorMM.getMessages()) {
            this.executorMessageManager.add(message);
          }

          return {
            completed: false,
            requiresHumanInput: true,
          };
        }

        // Continue to next iteration
      } else {
        // No tool calls, might be done
        break;
      }
    }

    // Add all messages to message manager
    for (const message of executorMM.getMessages()) {
      this.executorMessageManager.add(message);
    }

    // Hit max iterations without explicit completion
    Logging.log(
      "TeachAgent",
      `Executor hit max iterations (${MAX_EXECUTOR_ITERATIONS})`,
      "warning",
    );

    // Store the tool messages from this iteration
    this.plannerExecutionHistory.push({
      plannerOutput,
      toolMessages: currentIterationToolMessages,
      plannerIterations : this.iterations,
    });

    return { completed: false };
  }

  // Override _emitDebug to use teach-mode events
  protected _emitDebug(action: string, details?: any, maxLength: number = 200): void {
    if (!isDevelopmentMode()) return;

    let message = action;
    if (details !== undefined && details !== null) {
      let detailString: string;
      if (typeof details === 'object') {
        detailString = JSON.stringify(details, null, 2);
      } else {
        detailString = String(details);
      }

      if (detailString.length > maxLength) {
        detailString = detailString.substring(0, maxLength) + '...';
      }
      message = `${action}: ${detailString}`;
    }

    // Use teach-mode event for dev debug
    const debugMsgId = PubSub.generateId('teach_debug');
    this._emitThinking(debugMsgId, `[DEV MODE] ${message}`);

    // Also log to console for development
    Logging.log("TeachAgent", message, "info");
  }

  protected _handleExecutionError(error: unknown): void {
    if (error instanceof AbortError) {
      Logging.log("TeachAgent", "Execution aborted by user", "info");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    Logging.log("TeachAgent", `Execution error: ${errorMessage}`, "error");

    // Note: Execution.ts will publish 'failed' event when error is caught
    // We just log the error message
    this._emitMessage(`Error: ${errorMessage}`, 'error');
  }

  /**
   * Build execution history for planner context
   */
  private _buildPlannerExecutionHistory(): string {
    if (this.plannerExecutionHistory.length === 0) {
      return "No execution history yet";
    }

    return this.plannerExecutionHistory.map((entry, index) => {
      let plannerSection = "";

      if ('summary' in entry.plannerOutput) {
        // Type is of ExecutionHistorySummary
        const summary = entry.plannerOutput as ExecutionHistorySummary;
        const iterationNumber = entry.plannerIterations;

        return `=== ITERATIONS 1-${iterationNumber} SUMMARY ===\n${summary.summary}`;
      }

      // Dynamic planner output only (predefined planner removed)
      const plan = entry.plannerOutput as PlannerOutput;
      plannerSection = `PLANNER OUTPUT:
- Task: ${plan.userTask}
- Current State: ${plan.currentState}
- Execution History: ${plan.executionHistory}
- Challenges Identified: ${plan.challengesIdentified}
- Reasoning: ${plan.stepByStepReasoning}
- Actions Planned: ${plan.proposedActions.join(', ')}`;

      const toolSection = entry.toolMessages.length > 0
        ? `TOOL EXECUTIONS:\n${entry.toolMessages.join('\n')}`
        : "No tool executions";

      const iterationNumber = entry.plannerIterations;

      return `=== ITERATION ${iterationNumber} ===\n${plannerSection}\n\n${toolSection}`;
    }).join('\n\n');
  }

  private async summarizeExecutionHistory(history: string): Promise<ExecutionHistorySummary> {

    // Get LLM with structured output
    const llm = await getLLM({
      temperature: 0.2,
      maxTokens: 4096,
    });
    const structuredLLM = llm.withStructuredOutput(ExecutionHistorySummarySchema);
    const systemPrompt = generateExecutionHistorySummaryPrompt();
    const userPrompt = `Execution History: ${history}`;
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];
    const result = await invokeWithRetry<ExecutionHistorySummary>(structuredLLM, messages, 3, { signal: this.executionContext.abortSignal });
    return result;

  }

  /**
   * Build unified execution context combining planning and execution instructions
   */

  private _formatPlannerOutputForExecutor(plan: PlannerOutput): string {
    return `BrowserOS Agent Output:
- Task: ${plan.userTask}
- Current State: ${plan.currentState}
- Execution History: ${plan.executionHistory}
- Challenges Identified: ${plan.challengesIdentified}
- Reasoning: ${plan.stepByStepReasoning}

# Actions (to be performed by you)
${plan.proposedActions.map((action, i) => `    ${i + 1}. ${action}`).join('\n')}
`;
  }
  private _buildExecutionContext(
    plan: PlannerOutput | null = null,
    actions: string[] | null = null,
  ): string {
    const supportsVision = this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode();

    const analysisSection = supportsVision
      ? `<screenshot-analysis>
  The screenshot shows the webpage with nodeId numbers overlaid as visual labels on elements.
  These appear as numbers in boxes/labels (e.g., [21], [42], [156]) directly on the webpage elements.
  YOU MUST LOOK AT THE SCREENSHOT FIRST to identify which nodeId belongs to which element.
</screenshot-analysis>`
      : `<text-only-analysis>
  You are operating in TEXT-ONLY mode without screenshots.
  Use the browser state text to identify elements by their nodeId, text content, and attributes.
  Focus on element descriptions and hierarchical structure in the browser state.
</text-only-analysis>`;

    const processSection = supportsVision
      ? `<visual-execution-process>
  1. EXAMINE the screenshot - See the webpage with nodeId labels overlaid on elements
  2. LOCATE the element you need to interact with visually
  3. IDENTIFY its nodeId from the label shown on that element in the screenshot
  4. EXECUTE using that nodeId in your tool call
</visual-execution-process>`
      : `<text-execution-process>
  1. ANALYZE the browser state text to understand page structure
  2. LOCATE elements by their text content, type, and attributes
  3. IDENTIFY the correct nodeId from the browser state
  4. EXECUTE using that nodeId in your tool call
</text-execution-process>`;

    const guidelines = supportsVision
      ? `<execution-guidelines>
  - The nodeIds are VISUALLY LABELED on the screenshot - you must look at it
  - The text-based browser state is supplementary - the screenshot is your primary reference
  - Batch multiple tool calls in one response when possible (reduces latency)
  - Call 'done' when all actions are completed
</execution-guidelines>`
      : `<execution-guidelines>
  - Use the text-based browser state as your primary reference
  - Match elements by their text content and attributes
  - Batch multiple tool calls in one response when possible (reduces latency)
  - Call 'done' when all actions are completed
</execution-guidelines>`;

    let planningContext = '';
    if (plan) {
      planningContext = `<planning-context>
  <userTask>${plan.userTask}</userTask>
  <currentState>${plan.currentState}</currentState>
  <executionHistory>${plan.executionHistory}</executionHistory>
  <challengesIdentified>${plan.challengesIdentified}</challengesIdentified>
  <reasoning>${plan.stepByStepReasoning}</reasoning>
</planning-context>
`;
    }
    let actionsToExecute = '';
    if (actions) {
      actionsToExecute = `<actions-to-execute>
${actions.map((action, i) => `    ${i + 1}. ${action}`).join('\n')}
</actions-to-execute>
`;
    }

    return `${planningContext}<execution-instructions>
${analysisSection}
${processSection}
<element-format>
Elements appear as: [nodeId] <indicator> <tag> "text" context

Legend:
- [nodeId]: Use this number in click/type calls
- <C>/<T>: Clickable or Typeable
</element-format>
${guidelines}
${actionsToExecute}
</execution-instructions>`;
  }
}

