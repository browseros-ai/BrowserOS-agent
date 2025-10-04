import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "@/lib/llm/LangChainProvider";
import { Logging } from "@/lib/utils/Logging";
import { AbortError } from "@/lib/utils/Abortable";
import { invokeWithRetry } from "@/lib/utils/retryable";
import { TokenCounter } from "@/lib/utils/TokenCounter";
import { BaseAgent } from "./BaseAgent";
import {
  generateExecutorPrompt,
  generatePlannerPrompt,
  generatePredefinedPlannerPrompt,
  getToolDescriptions,
  generateExecutionHistorySummaryPrompt,
} from "./LocalAgent.prompt";
import {
  parseReasoning,
  parseProposedActions,
  parseTaskComplete,
  parseFinalAnswer,
  parseTodoMarkdown,
  parseSummary,
} from "./LocalAgent.parsing";

// Constants
const MAX_PLANNER_ITERATIONS = 50;
const MAX_EXECUTOR_ITERATIONS = 3;
const MAX_PREDEFINED_PLAN_ITERATIONS = 30;
const MAX_RETRIES = 3;

// LocalAgent-specific planner output types (uses string parsing instead of Zod)
interface PlannerOutput {
  reasoning: string;
  proposedActions: string;
  taskComplete: boolean;
  finalAnswer: string;
}

interface PredefinedPlannerOutput {
  reasoning: string;
  todoMarkdown: string;
  proposedActions: string;
  taskComplete: boolean;
  finalAnswer: string;
}

interface ExecutionHistorySummary {
  summary: string;
}

interface PlannerResult {
  ok: boolean;
  output?: PlannerOutput;
  error?: string;
}

interface PredefinedPlannerResult {
  ok: boolean;
  output?: PredefinedPlannerOutput;
  error?: string;
}

interface ExecutorResult {
  completed: boolean;
  doneToolCalled?: boolean;
  requiresHumanInput?: boolean;
}

export class LocalAgent extends BaseAgent {
  // Planner context - accumulates across all iterations
  private plannerExecutionHistory: Array<{
    plannerOutput: PlannerOutput | PredefinedPlannerOutput | ExecutionHistorySummary;
    toolMessages: string[];
    plannerIterations: number;
  }> = [];
  private toolDescriptions: string = "";

  constructor(executionContext: ExecutionContext) {
    super(executionContext, "LocalAgent");

    // Update tool descriptions (LocalAgent doesn't use limited context mode filtering)
    this.toolDescriptions = getToolDescriptions();
  }

  // Override to register all tools without limited context filtering
  protected async _registerStandardTools(): Promise<void> {
    await super._registerStandardTools();

    // LocalAgent always registers GrepElementsTool regardless of context mode
    // (BaseAgent only registers it in limited context mode)
    if (!this.executionContext.isLimitedContextMode()) {
      this.toolManager.register((await import('@/lib/tools')).GrepElementsTool(this.executionContext));
    }

    // Update tool descriptions after all tools are registered
    this.toolDescriptions = getToolDescriptions();

    Logging.log(
      "LocalAgent",
      `Registered ${this.toolManager.getAll().length} tools`,
      "info",
    );
  }

  /**
   * Check if task is a special predefined task and return its metadata
   * @param task - The original task string
   * @returns Metadata with predefined plan or null if not a special task
   */
  private _getSpecialTaskMetadata(task: string): {task: string, metadata: ExecutionMetadata} | null {
    // Case-insensitive comparison
    const taskLower = task.toLowerCase();

    // BrowserOS Launch Upvote Task
    if (taskLower === "read about our vision and upvote ❤️") {
      return {
        task: "Read about our vision and upvote",
        metadata: {
          executionMode: 'predefined' as const,
          predefinedPlan: {
            agentId: 'browseros-launch-upvoter',
            name: "BrowserOS Launch Upvoter",
            goal: "Navigate to BrowserOS launch page and upvote it",
            steps: [
              "Navigate to https://dub.sh/browseros-launch",
              "Find and click the upvote button on the page using visual_click",
              "Use celebration tool to show confetti animation"
            ]
          }
        }
      };
    }

    // GitHub Star Task
    if (taskLower === "support browseros on github ⭐") {
      return {
        task: "Support BrowserOS on GitHub",
        metadata: {
          executionMode: 'predefined' as const,
          predefinedPlan: {
            agentId: 'github-star-browseros',
            name: "GitHub Repository Star",
            goal: "Navigate to BrowserOS GitHub repo and star it",
            steps: [
              "Navigate to https://git.new/browserOS",
              "Check if the star button indicates already starred (filled star icon)",
              "If not starred (outline star icon), click the star button to star the repository",
              "Use celebration_tool to show confetti animation"
            ]
          }
        }
      };
    }

    // Return null if not a special task
    return null;
  }

  // ============================================
  // Main execution entry point
  // ============================================

  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    // Check for special tasks and get their predefined plans
    const specialTaskMetadata = this._getSpecialTaskMetadata(task);

    let _task = task;
    let _metadata = metadata;

    if (specialTaskMetadata) {
      _task = specialTaskMetadata.task;
      _metadata = { ...metadata, ...specialTaskMetadata.metadata };
      Logging.log("LocalAgent", `Special task detected: ${specialTaskMetadata.metadata.predefinedPlan?.name}`, "info");
    }

    try {
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      });

      Logging.log("LocalAgent", `Starting execution`, "info");
      await this._initialize();

      // Check for predefined plan
      if (_metadata?.executionMode === 'predefined' && _metadata.predefinedPlan) {
        await this._executePredefined(_task, _metadata.predefinedPlan);
      } else {
        await this._executeDynamic(_task);
      }
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
      await this._stopAllGlowAnimations();
    }
  }

  // ============================================
  // Dynamic planning execution
  // ============================================

  // ============================================
  // Predefined plan execution
  // ============================================

  private async _executePredefined(task: string, plan: any): Promise<void> {
    this.executionContext.setCurrentTask(task);

    // Convert predefined steps to TODO markdown
    const todoMarkdown = plan.steps.map((step: string) => `- [ ] ${step}`).join('\n');
    this.executionContext.setTodoList(todoMarkdown);

    // Validate LLM is initialized with tools bound
    if (!this.executorLlmWithTools) {
      throw new Error("LLM with tools not initialized");
    }

    // Publish start message
    this._emitMessage(
      `Executing agent: ${plan.name || 'Custom Agent'}`,
      "thinking"
    );

    let allComplete = false;
    let retries = 0;

    while (!allComplete && this.iterations < MAX_PREDEFINED_PLAN_ITERATIONS) {
      this.checkIfAborted();
      this.iterations++;

      Logging.log(
        "LocalAgent",
        `Predefined plan iteration ${this.iterations}/${MAX_PREDEFINED_PLAN_ITERATIONS}`,
        "info"
      );

      // Run predefined planner with current TODO state
      const planResult = await this._runPredefinedPlanner(task, this.executionContext.getTodoList());

      if (!planResult.ok) {
        Logging.log(
          "LocalAgent",
          `Predefined planning failed: ${planResult.error}`,
          "error"
        );
        retries++;
        if (retries >= MAX_RETRIES) {
          throw new Error(`Predefined planning failed: ${planResult.error}`);
        }
        continue;
      }

      const plan = planResult.output!;

      // Check if all complete
      if (plan.taskComplete) {
        allComplete = true;
        const finalMessage = plan.finalAnswer || "All steps completed successfully";
        this._emitMessage(finalMessage, 'assistant');
        break;
      }

      // Validate we have actions
      if (!plan.proposedActions || plan.proposedActions.trim().length === 0) {
        Logging.log(
          "LocalAgent",
          "Predefined planner provided no actions but task not complete",
          "warning"
        );
        retries++;
        if (retries >= MAX_RETRIES) {
          throw new Error(`Predefined planner provided no actions but TODOs not complete`);
        }
        continue;
      }

      Logging.log(
        "LocalAgent",
        `Executing actions for current TODO`,
        "info"
      );

      // Execute the actions
      const executorResult = await this._runExecutor(plan.proposedActions, plan);

      // Handle human input if needed
      if (executorResult.requiresHumanInput) {
        const humanResponse = await this._waitForHumanInput();
        if (humanResponse === 'abort') {
          this._emitMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }
        this._emitMessage('✅ Human completed manual action. Continuing...', 'thinking');
        this.executionContext.clearHumanInputState();
      }
    }

    // Check if we hit iteration limit
    if (!allComplete && this.iterations >= MAX_PREDEFINED_PLAN_ITERATIONS) {
      this._emitMessage(
        `Predefined plan did not complete within ${MAX_PREDEFINED_PLAN_ITERATIONS} iterations`,
        "error"
      );
      throw new Error(
        `Maximum predefined plan iterations (${MAX_PREDEFINED_PLAN_ITERATIONS}) reached or planning failed`
      );
    }

    Logging.log("LocalAgent", `Predefined plan execution complete`, "info");
  }

  private async _executeDynamic(task: string): Promise<void> {
    // Set current task in context
    this.executionContext.setCurrentTask(task);

    // Validate LLM is initialized with tools bound
    if (!this.executorLlmWithTools) {
      throw new Error("LLM with tools not initialized");
    }

    let done = false;
    let retries = 0;

    // Publish start message
    this._emitMessage("Starting task execution...", "thinking");

    while (!done && this.iterations < MAX_PLANNER_ITERATIONS) {
      this.checkIfAborted();
      this.iterations++;

      Logging.log(
        "LocalAgent",
        `Planning iteration ${this.iterations}/${MAX_PLANNER_ITERATIONS}`,
        "info",
      );

      // Get reasoning and high-level actions
      const planResult = await this._runDynamicPlanner(task);

      if (!planResult.ok) {
        Logging.log(
          "LocalAgent",
          `Planning failed: ${planResult.error}`,
          "error",
        );
        retries++;
        if (retries >= MAX_RETRIES) {
          throw new Error(`Planning failed: ${planResult.error}`);
        }
        continue;
      }

      const plan = planResult.output!;

      // Publish reasoning to UI
      this.executionContext.publishMessage(plan.reasoning, 'info');

      // Check if task is complete
      if (plan.taskComplete) {
        done = true;
        const completionMessage = plan.finalAnswer || "Task completed successfully";
        this.executionContext.publishMessage(completionMessage, 'success');
        break;
      }

      // Validate we have actions if not complete
      if (!plan.proposedActions || plan.proposedActions.trim().length === 0) {
        Logging.log(
          "LocalAgent",
          "Planner provided no actions but task not complete",
          "warning",
        );
        retries++;
        if (retries >= MAX_RETRIES) {
          throw new Error(`Planning failed: Planner provided no actions but task not complete`);
        }
        continue;
      }

      Logging.log(
        "LocalAgent",
        `Executing actions from plan`,
        "info",
      );

      const executorResult = await this._runExecutor(plan.proposedActions, plan);

      // Check execution outcomes
      if (executorResult.requiresHumanInput) {
        // Human input requested - wait for response
        const humanResponse = await this._waitForHumanInput();

        if (humanResponse === 'abort') {
          this._emitMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }

        // Human clicked "Done" - continue with next planning iteration
        this._emitMessage('✅ Human completed manual action. Re-planning...', 'thinking');

        // Clear human input state
        this.executionContext.clearHumanInputState();
      }
    }

    // Check if we hit planning iteration limit
    if (!done && this.iterations >= MAX_PLANNER_ITERATIONS) {
      this._emitMessage(
        `Task did not complete within ${MAX_PLANNER_ITERATIONS} planning iterations`,
        "error",
      );
      throw new Error(
        `Maximum planning iterations (${MAX_PLANNER_ITERATIONS}) reached`,
      );
    }
  }

  // ============================================
  // Planner implementations
  // ============================================


  private async _runDynamicPlanner(task: string): Promise<PlannerResult> {
    try {
      this.executionContext.incrementMetric("observations");

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
      const systemPrompt = generatePlannerPrompt(this.toolDescriptions || "");

      const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt));
      const fullHistoryTokens = TokenCounter.countMessage(new HumanMessage(fullHistory));
      Logging.log("LocalAgent", `Full execution history tokens: ${fullHistoryTokens}`, "info");

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

      Logging.log("LocalAgent", `Full execution history: ${fullHistory}`, "info");

      // Get LLM for string output
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      });
      const executionContext = this._buildExecutionContext();

      const userPrompt = `TASK: ${task}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Observations taken: ${metrics.observations}
- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds
${parseInt(errorRate) > 30 && metrics.errors > 3 ? "⚠️ HIGH ERROR RATE - Current approach may be failing. Learn from the past execution history and adapt your approach" : ""}

${executionContext}

YOUR PREVIOUS STEPS DONE SO FAR (what you thought would work):
${fullHistory}

Continue upon the previous steps what has been done so far and suggest next steps to complete the task.
`;
      const userPromptTokens = TokenCounter.countMessage(new HumanMessage(userPrompt));
      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
        /* simplified */ true,
        /* screenshotSize */ "large",
        /* includeBrowserState */ true,
        /* browserStateTokensLimit */ (this.executionContext.getMaxTokens() - systemPromptTokens - userPromptTokens)*0.8
      );
      // Build messages
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
        browserStateMessage,
      ];

      // Get string response from LLM with retry logic
      const response = await invokeWithRetry(
        llm,
        messages,
        MAX_RETRIES,
        { signal: this.executionContext.abortSignal }
      );

      // Parse the string response into structured output
      const outputString = (response as any)?.content as string || "";
      const reasoning = parseReasoning(outputString);
      const proposedActions = parseProposedActions(outputString);
      const taskComplete = parseTaskComplete(outputString);
      const finalAnswer = parseFinalAnswer(outputString);

      const result: PlannerOutput = {
        reasoning,
        proposedActions,
        taskComplete,
        finalAnswer,
      };

      // Store structured reasoning in context as JSON
      const plannerState = {
        reasoning: result.reasoning,
        proposedActions: result.proposedActions,
        taskComplete: result.taskComplete,
        finalAnswer: result.finalAnswer,
      };
      this.executionContext.addReasoning(JSON.stringify(plannerState));

      // Log planner decision
      Logging.log(
        "LocalAgent",
        result.taskComplete
          ? `Planner: Task complete with final answer`
          : `Planner: actions planned`,
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
    actions: string,
    plannerOutput: PlannerOutput | PredefinedPlannerOutput
  ): Promise<ExecutorResult> {
    // Use the current iteration message manager from execution context
    const executorMM = new MessageManager();
    const systemPrompt = generateExecutorPrompt(this._buildExecutionContext());
    const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt));
    executorMM.addSystem(systemPrompt);
    const currentIterationToolMessages: string[] = [];
    let executorIterations = 0;
    let isFirstPass = true;

    while (executorIterations < MAX_EXECUTOR_ITERATIONS) {
      this.checkIfAborted();
      executorIterations++;

      // Add browser state and simple prompt
      if (isFirstPass) {
        // Add current browser state without screenshot

        // Build execution context with planner output
        const plannerOutputForExecutor = this._formatPlannerOutputForExecutor(plannerOutput);

        const executionContext = this._buildExecutionContext();
        const additionalTokens = TokenCounter.countMessage(new HumanMessage(executionContext + '\n'+ plannerOutputForExecutor));

        const browserStateMessage = await this._getBrowserStateMessage(
          /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
          /* simplified */ true,
          /* screenshotSize */ "medium",
          /* includeBrowserState */ true,
          /* browserStateTokensLimit */ (this.executionContext.getMaxTokens() - systemPromptTokens - additionalTokens)*0.8
        );
        executorMM.add(browserStateMessage);
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

      // Get LLM response with tool calls
      const llmResponse = await this._invokeLLMWithStreaming(executorMM);

      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        // Process tool calls
        executorMM.add(llmResponse);
        const { result, toolResults } = await this._processToolCalls(
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
        executorMM.flushQueue();

        // Check for special outcomes
        if (result.doneToolCalled) {
          // Store the tool messages from this iteration before returning
          this.plannerExecutionHistory.push({
            plannerOutput,
            toolMessages: currentIterationToolMessages,
            plannerIterations: this.iterations,
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

        if (result.requiresHumanInput) {
          // Store the tool messages from this iteration before returning
          this.plannerExecutionHistory.push({
            plannerOutput,
            toolMessages: currentIterationToolMessages,
            plannerIterations: this.iterations,
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
      "LocalAgent",
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

  // ============================================
  // Executor implementation
  // ============================================

  /**
   * Run the predefined planner to track TODO progress and generate actions
   */
  private async _runPredefinedPlanner(
    task: string,
    currentTodos: string
  ): Promise<PredefinedPlannerResult> {
    try {
      this.executionContext.incrementMetric("observations");

      // Get execution metrics for analysis
      const metrics = this.executionContext.getExecutionMetrics();
      const errorRate = metrics.toolCalls > 0
        ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
        : "0";
      const elapsed = Date.now() - metrics.startTime;

      // Get accumulated execution history from all iterations
      let fullHistory = this._buildPlannerExecutionHistory();

      const systemPrompt = generatePredefinedPlannerPrompt(this.toolDescriptions || "");
      const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt));
      const fullHistoryTokens = TokenCounter.countMessage(new HumanMessage(fullHistory));
      Logging.log("LocalAgent", `Full execution history tokens: ${fullHistoryTokens}`, "info");
      if (fullHistoryTokens + systemPromptTokens > this.executionContext.getMaxTokens() * 0.7) {
        const summary = await this.summarizeExecutionHistory(fullHistory);

        // Clear the planner execution history after summarizing and add summarized state to the history
        this.plannerExecutionHistory = [];
        this.plannerExecutionHistory.push({
          plannerOutput: summary,
          toolMessages: [],
          plannerIterations: this.iterations - 1, // Subtract 1 because the summary is for the previous iterations
        });

        fullHistory = summary.summary;
      }

      // Get LLM for string output
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      });
      const executionContext = this._buildExecutionContext();

      const userPrompt = `Current TODO List:
${currentTodos}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Observations taken: ${metrics.observations}
- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds
${parseInt(errorRate) > 30 && metrics.errors > 3 ? "⚠️ HIGH ERROR RATE - Current approach may be failing. Learn from the past execution history and adapt your approach" : ""}

${executionContext}

YOUR PREVIOUS STEPS DONE SO FAR (what you thought would work):
${fullHistory}

Continue upon your previous steps what has been done so far and suggest next steps to complete the current TODO item.
`;
      const userPromptTokens = TokenCounter.countMessage(new HumanMessage(userPrompt));
      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
        /* simplified */ true,
        /* screenshotSize */ "large",
        /* includeBrowserState */ true,
        /* browserStateTokensLimit */ (this.executionContext.getMaxTokens() - systemPromptTokens - userPromptTokens)*0.8
      );
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
        browserStateMessage,
      ];

      // Get string response with retry
      const response = await invokeWithRetry(
        llm,
        messages,
        MAX_RETRIES,
        { signal: this.executionContext.abortSignal }
      );

      // Parse the string response into structured output
      const outputString = (response as any)?.content as string || "";
      const reasoning = parseReasoning(outputString);
      const todoMarkdown = parseTodoMarkdown(outputString);
      const proposedActions = parseProposedActions(outputString);
      const taskComplete = parseTaskComplete(outputString);
      const finalAnswer = parseFinalAnswer(outputString);

      const plan: PredefinedPlannerOutput = {
        reasoning,
        todoMarkdown,
        proposedActions,
        taskComplete,
        finalAnswer,
      };

      // Store structured reasoning in context as JSON
      const plannerState = {
        reasoning: plan.reasoning,
        todoMarkdown: plan.todoMarkdown,
        proposedActions: plan.proposedActions,
        taskComplete: plan.taskComplete,
        finalAnswer: plan.finalAnswer,
      };
      this.executionContext.addReasoning(JSON.stringify(plannerState));

      // Publish updated TODO list
      this._emitMessage(plan.todoMarkdown, "thinking");
      this.executionContext.setTodoList(plan.todoMarkdown);

      // Publish reasoning
      this.executionContext.publishMessage(plan.reasoning, 'info');

      // Log planner decision
      Logging.log(
        "LocalAgent",
        plan.taskComplete
          ? `Predefined Planner: All TODOs complete with final answer`
          : `Predefined Planner: actions planned for current TODO`,
        "info",
      );


      return {
        ok: true,
        output: plan,
      };
    } catch (error) {
      this.executionContext.incrementMetric("errors");
      return {
        ok: false,
        error: `Predefined planning failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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

      if (!('todoMarkdown' in entry.plannerOutput)) {
        // Dynamic planner output
        const plan = entry.plannerOutput as PlannerOutput;
        plannerSection = `PLANNER OUTPUT:
- Reasoning: ${plan.reasoning}
- Proposed Actions: ${plan.proposedActions}`;
      } else {
        // Predefined planner output
        const plan = entry.plannerOutput as PredefinedPlannerOutput;
        plannerSection = `PLANNER OUTPUT:
- Reasoning: ${plan.reasoning}
- TODO Markdown: ${plan.todoMarkdown}
- Proposed Actions: ${plan.proposedActions}`;
      }

      const toolSection = entry.toolMessages.length > 0
        ? `TOOL EXECUTIONS:\n${entry.toolMessages.join('\n')}`
        : "No tool executions";

      const iterationNumber = entry.plannerIterations;

      return `=== ITERATION ${iterationNumber} ===\n${plannerSection}\n\n${toolSection}`;
    }).join('\n\n');
  }

  private async summarizeExecutionHistory(history: string): Promise<ExecutionHistorySummary> {
    // Remove Reasoning, TODO Markdown, and Proposed Actions sections before summarizing
    // This strips lines starting with those section headers (case-insensitive, with or without colon)
    const historyWithoutSections = history
      .split('\n')
      .filter(line =>
        !/^[-*]\s*Reasoning[:]?/i.test(line.trim()) &&
        !/^[-*]\s*TODO Markdown[:]?/i.test(line.trim()) &&
        !/^[-*]\s*Proposed Actions[:]?/i.test(line.trim())
      )
      .join('\n')

    // Get LLM for string output
    const llm = await getLLM({
      temperature: 0.2,
      maxTokens: 4096,
    });
    const systemPrompt = generateExecutionHistorySummaryPrompt();
    const userPrompt = `Execution History: ${historyWithoutSections}`;
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];
    const response = await invokeWithRetry(llm, messages, MAX_RETRIES, { signal: this.executionContext.abortSignal });

    // Parse the string response into structured output
    const summary = parseSummary((response as any)?.content as string || "");

    return { summary };
  }

  /**
   * Build execution context for current iteration
   */
  private _buildExecutionContext(
    plannerOutput: PlannerOutput | PredefinedPlannerOutput | null = null,
    actions: string[] | null = null,
  ): string {
    if (plannerOutput && 'todoMarkdown' in plannerOutput) {
      // It's a PredefinedPlannerOutput
      return this._buildPredefinedExecutionContext(plannerOutput as PredefinedPlannerOutput, actions);
    } else {
      // It's a PlannerOutput or null
      return this._buildDynamicExecutionContext(plannerOutput as PlannerOutput | null, actions);
    }
  }

  /**
   * Build execution context for predefined plans
   */
  private _buildPredefinedExecutionContext(
    plan: PredefinedPlannerOutput | null = null,
    actions: string[] | null = null,
  ): string {
    const supportsVision = this.executionContext.supportsVision();

    const analysisSection = supportsVision
      ? `<screenshot-analysis>
  The screenshot shows the webpage with nodeId numbers overlaid as visual labels on elements.
  These appear as numbers in boxes/labels (e.g., [21], [42], [156]) directly on the webpage elements.
  YOU MUST LOOK AT THE SCREENSHOT FIRST to identify which nodeId belongs to which element.
</screenshot-analysis>`
      : `<text-only-analysis>
  You are operating in TEXT-ONLY mode without screenshots.
  Use the browser state text to identify elements by their nodeId, text content, and attributes.
  If the element is not visible in the browser state (truncated or hidden elements), use grep_elements tool to find element followed by relevant click/type/select actions.
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
  1. ANALYZE the text-based browser state to identify the element you need to interact with
  2. Search with grep_elements tool using regex patterns to find elements if the element is not visible in the browser state (truncated or hidden elements)
  3. Identify the [nodeId] from the grep results or the browser state
  4. EXECUTE NODE_ID in your tool call
  NEVER guess nodeIds - USE BROWSER STATE OR GREP RESULTS TO IDENTIFY THE NODE_ID
</text-execution-process>`;

    const guidelines = supportsVision
      ? `<execution-guidelines>
  - The nodeIds are VISUALLY LABELED on the screenshot - you must look at it
  - The text-based browser state is supplementary - the screenshot is your primary reference
  - Batch multiple tool calls in one response when possible (reduces latency)
  - Call 'done' when the current actions are completed
</execution-guidelines>`
      : `<execution-guidelines>
  - Use the text-based browser state or grep results (if applicable) as your primary reference
  - Match elements by their text content and attributes
  - Batch multiple tool calls in one response when possible (reduces latency)
  - Call 'done' when the current actions are completed
</execution-guidelines>`;

    let predefinedPlanContext = '';
    if (plan) {
      predefinedPlanContext = `<predefined-plan-context>
  <reasoning>${plan.reasoning}</reasoning>
</predefined-plan-context> `;
    }
    let actionsToExecute = '';
    if (actions) {
      actionsToExecute = `<actions-to-execute>
${actions.map((action, i) => `    ${i + 1}. ${action}`).join('\n')}
  </actions-to-execute>
`;
    }
    return `${predefinedPlanContext}<execution-instructions>
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

  /**
   * Build unified execution context combining planning and execution instructions
   */

  private _formatPlannerOutputForExecutor(plan: PlannerOutput | PredefinedPlannerOutput): string {
    return `BrowserOS Agent Output:
- Reasoning: ${plan.reasoning}

# Actions (to be performed by you)
${plan.proposedActions}
`;
  }

  private _buildDynamicExecutionContext(
    plan: PlannerOutput | null = null,
    actions: string[] | null = null,
  ): string {
    const supportsVision = this.executionContext.supportsVision() && this.executionContext.isLimitedContextMode();

    // Enriched analysis section
    const analysisSection = supportsVision
      ? `<screenshot-analysis>
  You are provided with a screenshot of the webpage. Each interactive element is visually labeled with a nodeId (e.g., [21], [42], [156]) directly on the element.
  - The screenshot is your PRIMARY reference for identifying elements.
  - The browser state text is available as a supplementary resource, but you must always use the screenshot to determine the correct nodeId.
  - NodeIds are visually overlaid as numbers in boxes/labels on the elements themselves.
  - Pay attention to the visual context, layout, and grouping of elements to accurately identify the target.
  - If multiple elements have similar text, use their position and visual grouping to distinguish them.
</screenshot-analysis>`
      : `<text-only-analysis>
  You are operating in TEXT-ONLY mode (no screenshots available).
  - Use the browser state text to understand the current state of the webpage and to identify the relevant element for interaction.
  - The browser state may be truncated or have hidden elements; always check for missing or incomplete information.
  - If the element you need is not visible in the browser state, use the grep_elements tool to search for it by text, tag, or attribute.
  - Focus on element descriptions, their hierarchical structure, and any unique attributes or text to identify the correct element.
  - Be methodical: always confirm the nodeId before taking any action.
</text-only-analysis>`;

    // Enriched process section
    const processSection = supportsVision
      ? `<visual-execution-process>
  1. EXAMINE the screenshot carefully to see all elements with their nodeId labels.
  2. LOCATE the element you need to interact with by visually matching its appearance, text, and position.
  3. IDENTIFY the nodeId from the label shown directly on the element in the screenshot.
  4. EXECUTE your tool call using the identified nodeId (never guess).
  5. Batch multiple tool calls in one response when possible to reduce latency.
  6. Call 'done' when all actions are completed.
  - If you are unsure about an element, cross-reference with the browser state text for additional context.
</visual-execution-process>`
      : `<text-execution-process>
  1. ANALYZE the text-based browser state to find the element you need to interact with.
  2. If the element is not visible or the browser state is incomplete, use the grep_elements tool with appropriate regex patterns to search for the element.
      - Example patterns: grep_elements("button.*(login|submit)"), grep_elements("input.*(email|password)")
      - If no results, try broader patterns like "button" or "input"
  3. From the grep_elements results or browser state, extract the [nodeId] (e.g., [42] <C> <button> "Login").
  4. EXECUTE your tool call using the precise nodeId you have found.
  5. NEVER guess nodeIds – always confirm using browser state or grep_elements results.
  6. Batch multiple tool calls in one response when possible to reduce latency.
  7. Call 'done' when all actions are completed.
</text-execution-process>`;

    let planningContext = '';
    if (plan) {
      planningContext = `<planning-context>
  <reasoning>${plan.reasoning}</reasoning>
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
${actionsToExecute}
</execution-instructions>`;
  }
}
