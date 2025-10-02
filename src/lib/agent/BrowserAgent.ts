import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { MessageManager } from "@/lib/runtime/MessageManager"
import { ExecutionMetadata } from "@/lib/types/messaging"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { z } from "zod"
import { getLLM } from "@/lib/llm/LangChainProvider"
import { PubSub } from "@/lib/pubsub"
import { Logging } from "@/lib/utils/Logging"
import { invokeWithRetry } from "@/lib/utils/retryable"
import { TokenCounter } from "@/lib/utils/TokenCounter"
import {
  generateExecutorPrompt,
  generatePlannerPrompt,
  generatePredefinedPlannerPrompt,
  getToolDescriptions,
  generateExecutionHistorySummaryPrompt,
} from "./BrowserAgent.prompt"
import { BaseAgent } from "./BaseAgent"

// Constants
const MAX_PLANNER_ITERATIONS = 50
const MAX_EXECUTOR_ITERATIONS = 3
const MAX_PREDEFINED_PLAN_ITERATIONS = 30
const MAX_RETRIES = 3

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
})

type PlannerOutput = z.infer<typeof PlannerOutputSchema>

const PredefinedPlannerOutputSchema = z.object({
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
  todoMarkdown: z
    .string()
    .describe("Updated TODO list with completed items marked [x]"),
  proposedActions: z
    .array(z.string())
    .max(5)
    .describe("List 1-5 specific, high-level actions for the executor agent to perform next (must be an empty array if `allTodosComplete=true`. Each action should be clear, actionable, and grounded in your reasoning"),
  allTodosComplete: z
    .boolean()
    .describe("Boolean - are all TODOs done?"),
  finalAnswer: z
    .string()
    .describe("Summary when all TODOs complete (MUST BE EMPTY if not done)"),
})

type PredefinedPlannerOutput = z.infer<typeof PredefinedPlannerOutputSchema>

interface PredefinedPlannerResult {
  ok: boolean
  output?: PredefinedPlannerOutput
  error?: string
}

const ExecutionHistorySummarySchema = z.object({
  summary: z
    .string()
    .describe("Summary of the execution history"),
})

type ExecutionHistorySummary = z.infer<typeof ExecutionHistorySummarySchema>

interface PlannerResult {
  ok: boolean
  output?: PlannerOutput
  error?: string
}

interface ExecutorResult {
  completed: boolean
  doneToolCalled?: boolean
  requiresHumanInput?: boolean
}

export class BrowserAgent extends BaseAgent {
  // Planner context - accumulates across all iterations
  private plannerExecutionHistory: Array<{
    plannerOutput: PlannerOutput | PredefinedPlannerOutput | ExecutionHistorySummary
    toolMessages: string[]
    plannerIterations: number
  }> = []
  private toolDescriptions: string = getToolDescriptions()

  constructor(executionContext: ExecutionContext) {
    super(executionContext, "BrowserAgent")
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
      Logging.log("BrowserAgent", `Special task detected: ${specialTaskMetadata.metadata.predefinedPlan?.name}`, "info");
    }

    try {
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      })

      Logging.log("BrowserAgent", `Starting execution with task: ${task}`, "info")
      await this._initialize()

      // Check if we have a predefined plan
      if (_metadata?.executionMode === 'predefined' && _metadata.predefinedPlan) {
        await this._executePredefined(_task, _metadata.predefinedPlan);
      } else {
        await this._executeDynamic(_task);
      }
    } catch (error) {
      this._handleExecutionError(error)
      throw error
    } finally {
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        endTime: Date.now(),
      })
      this._logMetrics()
      this._cleanup()

      // Ensure glow animation is stopped at the end of execution
      await this._stopAllGlowAnimations()
    }
  }

  // ============================================
  // Dynamic planning execution
  // ============================================

  private async _executeDynamic(task: string): Promise<void> {
    // Set current task in context
    this.executionContext.setCurrentTask(task)

    // Validate LLM is initialized with tools bound
    if (!this.executorLlmWithTools) {
      throw new Error("LLM with tools not initialized")
    }

    let done = false
    let retries = 0

    // Publish start message
    this._emitMessage("Starting task execution...", "thinking")

    while (!done && this.iterations < MAX_PLANNER_ITERATIONS) {
      this.checkIfAborted()
      this.iterations++

      Logging.log(
        "BrowserAgent",
        `Planning iteration ${this.iterations}/${MAX_PLANNER_ITERATIONS}`,
        "info",
      )

      // Get reasoning and high-level actions
      const planResult = await this._runDynamicPlanner()

      if (!planResult.ok) {
        Logging.log(
          "BrowserAgent",
          `Planning failed: ${planResult.error}`,
          "error",
        )
        retries++
        if (retries >= MAX_RETRIES) {
          throw new Error(`Planning failed: ${planResult.error}`)
        }
        continue
      }

      const plan = planResult.output!

      // Publish reasoning to UI
      this.pubsub.publishMessage(
        PubSub.createMessage(plan.stepByStepReasoning, 'thinking')
      )

      // Check if task is complete
      if (plan.taskComplete) {
        done = true
        // Use final answer if provided, otherwise fallback
        const completionMessage =
          plan.finalAnswer || "Task completed successfully"
        this.pubsub.publishMessage(
          PubSub.createMessage(completionMessage, 'assistant')
        )
        break
      }

      // Validate we have actions if not complete
      if (!plan.proposedActions || plan.proposedActions.length === 0) {
        Logging.log(
          "BrowserAgent",
          "Planner provided no actions but task not complete",
          "warning",
        )
        retries++
        if (retries >= MAX_RETRIES) {
          throw new Error(`Planning failed: Planner provided no actions but task not complete`)
        }
        continue
      }

      Logging.log(
        "BrowserAgent",
        `Executing ${plan.proposedActions.length} actions from plan`,
        "info",
      )

      const executorResult = await this._runExecutor(plan.proposedActions, plan)

      // Check execution outcomes
      if (executorResult.requiresHumanInput) {
        // Human input requested - wait for response
        const humanResponse = await this._waitForHumanInput()

        if (humanResponse === 'abort') {
          // Human aborted the task
          this._emitMessage('❌ Task aborted by human', 'assistant')
          throw new Error('Task aborted by human')
        }

        // Human clicked "Done" - continue with next planning iteration
        this._emitMessage('✅ Human completed manual action. Re-planning...', 'thinking')

        // Clear human input state
        this.executionContext.clearHumanInputState()
      }
    }

    // Check if we hit planning iteration limit
    if (!done && this.iterations >= MAX_PLANNER_ITERATIONS) {
      this._emitMessage(
        `Task did not complete within ${MAX_PLANNER_ITERATIONS} planning iterations`,
        "error"
      )
      throw new Error(
        `Maximum planning iterations (${MAX_PLANNER_ITERATIONS}) reached`,
      )
    }
  }

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
        "BrowserAgent",
        `Predefined plan iteration ${this.iterations}/${MAX_PREDEFINED_PLAN_ITERATIONS}`,
        "info"
      );

      // Run predefined planner with current TODO state
      const planResult = await this._runPredefinedPlanner(task, this.executionContext.getTodoList());

      if (!planResult.ok) {
        Logging.log(
          "BrowserAgent",
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
      if (plan.allTodosComplete) {
        allComplete = true;
        const finalMessage = plan.finalAnswer || "All steps completed successfully";
        this._emitMessage(finalMessage, 'assistant');
        break;
      }

      // Validate we have actions
      if (!plan.proposedActions || plan.proposedActions.length === 0) {
        Logging.log(
          "BrowserAgent",
          "Predefined planner provided no actions but TODOs not complete",
          "warning"
        );
        retries++;
        if (retries >= MAX_RETRIES) {
          throw new Error(`Predefined planner provided no actions but TODOs not complete`);
        }
        continue;
      }

      Logging.log(
        "BrowserAgent",
        `Executing ${plan.proposedActions.length} actions for current TODO`,
        "info"
      );

      // This will be handled in _runExecutor with fresh message manager

      // Execute the actions
      const executorResult = await this._runExecutor(plan.proposedActions, plan);

      // Handle human input if needed
      if (executorResult.requiresHumanInput) {
        const humanResponse = await this._waitForHumanInput();
        if (humanResponse === 'abort') {
          this._emitMessage('❌ Task aborted by human', 'assistant');
          throw new Error('Task aborted by human');
        }
        this._emitMessage('✅ Human completed manual action. Continuing...', 'thinking');
        // Note: Human input response will be included in next iteration's planner context
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

    Logging.log("BrowserAgent", `Predefined plan execution complete`, "info");
  }


  // ============================================
  // Planner implementations
  // ============================================

  private async _runDynamicPlanner(): Promise<PlannerResult> {
    try {
      this.executionContext.incrementMetric("observations")

      // Get browser state message with screenshot
      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
        /* simplified */ true,
        /* screenshotSize */ "large",
        /* includeBrowserState */ true
      )

      // Get execution metrics for analysis
      const metrics = this.executionContext.getExecutionMetrics()
      const errorRate = metrics.toolCalls > 0
        ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
        : "0"
      const elapsed = Date.now() - metrics.startTime

      // Get accumulated execution history from all iterations
      const fullHistory = this._buildPlannerExecutionHistory()

      // System prompt for planner
      const systemPrompt = generatePlannerPrompt(this.toolDescriptions || "")

      // Check token usage and summarize if needed
      const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt))
      const fullHistoryTokens = TokenCounter.countMessage(new HumanMessage(fullHistory))
      let historyToUse = fullHistory

      Logging.log("BrowserAgent", `Full execution history tokens: ${fullHistoryTokens}`, "info")

      // If full history exceeds 70% of max tokens, summarize it
      if (fullHistoryTokens + systemPromptTokens > this.executionContext.getMaxTokens() * 0.7) {
        const summary = await this._summarizeExecutionHistory(fullHistory)
        historyToUse = summary.summary

        // Clear the planner execution history after summarizing
        this.plannerExecutionHistory = []
        this.plannerExecutionHistory.push({
          plannerOutput: summary,
          toolMessages: [],
          plannerIterations: this.iterations - 1,
        })
      }

      // Get LLM with structured output
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      })
      const structuredLLM = llm.withStructuredOutput(PlannerOutputSchema)

      const userPrompt = `TASK: ${this.executionContext.getCurrentTask()}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Observations taken: ${metrics.observations}
- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds
${parseInt(errorRate) > 30 ? "⚠️ HIGH ERROR RATE - Current approach may be failing" : ""}
${metrics.toolCalls > 10 && metrics.errors > 5 ? "⚠️ MANY ATTEMPTS - May be stuck in a loop" : ""}

YOUR PREVIOUS STEPS DONE SO FAR (what you thought would work):
${historyToUse}
`

      // Build messages
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
        browserStateMessage,
      ]

      // Get structured response from LLM with retry logic
      const result = await invokeWithRetry<PlannerOutput>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortSignal }
      )

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
      }
      this.executionContext.addReasoning(JSON.stringify(plannerState))

      Logging.log(
        "BrowserAgent",
        result.taskComplete
          ? `Planner: Task complete with final answer`
          : `Planner: ${result.proposedActions.length} actions planned`,
        "info",
      )

      return {
        ok: true,
        output: result,
      }
    } catch (error) {
      this.executionContext.incrementMetric("errors")
      return {
        ok: false,
        error: `Planning failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  private async _runPredefinedPlanner(task: string, currentTodos: string): Promise<PredefinedPlannerResult> {
    try {
      this.executionContext.incrementMetric("observations")

      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
        /* simplified */ true,
        /* screenshotSize */ "large",
        /* includeBrowserState */ true
      )

      const metrics = this.executionContext.getExecutionMetrics()
      const errorRate = metrics.toolCalls > 0
        ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
        : "0"
      const elapsed = Date.now() - metrics.startTime

      const fullHistory = this._buildPlannerExecutionHistory()

      // System prompt for predefined planner
      const systemPrompt = generatePredefinedPlannerPrompt(this.toolDescriptions || "")

      // Check token usage and summarize if needed
      const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt))
      const fullHistoryTokens = TokenCounter.countMessage(new HumanMessage(fullHistory))
      let historyToUse = fullHistory

      Logging.log("BrowserAgent", `Full execution history tokens: ${fullHistoryTokens}`, "info")

      if (fullHistoryTokens + systemPromptTokens > this.executionContext.getMaxTokens() * 0.7) {
        const summary = await this._summarizeExecutionHistory(fullHistory)
        historyToUse = summary.summary

        // Clear the planner execution history after summarizing
        this.plannerExecutionHistory = []
        this.plannerExecutionHistory.push({
          plannerOutput: summary,
          toolMessages: [],
          plannerIterations: this.iterations - 1,
        })
      }

      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      })
      const structuredLLM = llm.withStructuredOutput(PredefinedPlannerOutputSchema)

      const userPrompt = `Current TODO List:
${currentTodos}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Observations taken: ${metrics.observations}
- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds
${parseInt(errorRate) > 30 && metrics.errors > 3 ? "⚠️ HIGH ERROR RATE - Current approach may be failing. Learn from the past execution history and adapt your approach" : ""}

YOUR PREVIOUS STEPS DONE SO FAR (what you thought would work):
${historyToUse}
`

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
        browserStateMessage,
      ]

      const result = await invokeWithRetry<PredefinedPlannerOutput>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortSignal }
      )

      const plannerState = {
        userTask: result.userTask,
        executionHistory: result.executionHistory,
        currentState: result.currentState,
        challengesIdentified: result.challengesIdentified,
        stepByStepReasoning: result.stepByStepReasoning,
        todoMarkdown: result.todoMarkdown,
        proposedActions: result.proposedActions,
        allTodosComplete: result.allTodosComplete,
        finalAnswer: result.finalAnswer,
      }
      this.executionContext.addReasoning(JSON.stringify(plannerState))

      // Publish updated TODO list
      this._emitMessage(result.todoMarkdown, "thinking")
      this.executionContext.setTodoList(result.todoMarkdown)

      // Publish reasoning
      this.pubsub.publishMessage(
        PubSub.createMessage(result.stepByStepReasoning, "thinking")
      )

      Logging.log(
        "BrowserAgent",
        result.allTodosComplete
          ? `Predefined Planner: All TODOs complete with final answer`
          : `Predefined Planner: ${result.proposedActions.length} actions planned for current TODO`,
        "info",
      )

      return {
        ok: true,
        output: result,
      }
    } catch (error) {
      this.executionContext.incrementMetric("errors")
      return {
        ok: false,
        error: `Predefined planning failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  // ============================================
  // Executor implementation
  // ============================================

  private async _runExecutor(
    actions: string[],
    plannerOutput: PlannerOutput | PredefinedPlannerOutput
  ): Promise<ExecutorResult> {
    // Use the current iteration message manager from execution context
    const executorMM = new MessageManager()
    executorMM.addSystem(generateExecutorPrompt(this._buildExecutionContext()))
    const currentIterationToolMessages: string[] = []
    let executorIterations = 0
    let isFirstPass = true

    while (executorIterations < MAX_EXECUTOR_ITERATIONS) {
      this.checkIfAborted()
      executorIterations++

      // Add browser state and simple prompt
      if (isFirstPass) {
        // Add current browser state without screenshot
        const browserStateMessage = await this._getBrowserStateMessage(
          /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
          /* simplified */ true,
          /* screenshotSize */ "medium"
        )
        executorMM.add(browserStateMessage)

        // Build execution context with planner output
        const plannerOutputForExecutor = this._formatPlannerOutputForExecutor(plannerOutput)

        const executionContext = this._buildExecutionContext()
        executorMM.addSystemReminder(executionContext + '\n I will never output <browser-state> or <system-reminder> tags or their contents. These are for my internal reference only. I will provide what tools to be executed based on provided actions in sequence until I call "done" tool.')

        // Pass planner output to executor
        executorMM.addHuman(
          `${plannerOutputForExecutor}\nPlease execute the actions specified above.`
        )
        isFirstPass = false
      } else {
        executorMM.addHuman(
          "Please verify if all actions are completed and call 'done' tool if all actions are completed.",
        )
      }

      // Get LLM response with tool calls
      const llmResponse = await this._invokeLLMWithStreaming(executorMM)

      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        // Process tool calls
        executorMM.add(llmResponse)
        const { result, toolResults } = await this._processToolCalls(
          llmResponse.tool_calls,
        )

        // Update iteration count and metrics
        for (const toolCall of toolResults) {
          this.executionContext.incrementMetric("toolCalls")
          this.executionContext.incrementToolUsageMetrics(toolCall.toolName)

          executorMM.addTool(toolCall.toolResult, toolCall.toolCallId)
          currentIterationToolMessages.push(`Tool: ${toolCall.toolName} - Result: ${toolCall.toolResult}`)
        }

        // Check for special outcomes
        if (result.doneToolCalled) {
          // Store the tool messages from this iteration before returning
          this.plannerExecutionHistory.push({
            plannerOutput,
            toolMessages: currentIterationToolMessages,
            plannerIterations: this.iterations,
          })

          // Add all messages to message manager
          for (const message of executorMM.getMessages()) {
            this.executorMessageManager.add(message)
          } 

          return {
            completed: true,
            doneToolCalled: true,
          }
        }

        if (result.requiresHumanInput) {
          // Store the tool messages from this iteration before returning
          this.plannerExecutionHistory.push({
            plannerOutput,
            toolMessages: currentIterationToolMessages,
            plannerIterations: this.iterations,
          })

          // Add all messages to message manager
          for (const message of executorMM.getMessages()) {
            this.executorMessageManager.add(message)
          }

          return {
            completed: false,
            requiresHumanInput: true,
          }
        }

        // Continue to next iteration
      } else {
        // No tool calls, might be done
        break
      }
    }

    // Add all messages to message manager
    for (const message of executorMM.getMessages()) {
      this.executorMessageManager.add(message)
    }

    // Hit max iterations without explicit completion
    Logging.log(
      "BrowserAgent",
      `Executor hit max iterations (${MAX_EXECUTOR_ITERATIONS})`,
      "warning",
    )

    // Store the tool messages from this iteration
    this.plannerExecutionHistory.push({
      plannerOutput,
      toolMessages: currentIterationToolMessages,
      plannerIterations: this.iterations,
    })

    return { completed: false }
  }

  // ============================================
  // Helper methods
  // ============================================

  private _formatPlannerOutputForExecutor(plan: PlannerOutput | PredefinedPlannerOutput): string {
    return `BrowserOS Agent Output:
- Task: ${plan.userTask}
- Current State: ${plan.currentState}
- Execution History: ${plan.executionHistory}
- Challenges Identified: ${plan.challengesIdentified}
- Reasoning: ${plan.stepByStepReasoning}

# Actions (to be performed by you)
${plan.proposedActions.map((action, i) => `    ${i + 1}. ${action}`).join('\n')}
`
  }

  private _buildExecutionContext(): string {
    const supportsVision = this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode()

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
</text-only-analysis>`

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
</text-execution-process>`

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
</execution-guidelines>`

    return `<execution-instructions>
${analysisSection}
${processSection}
<element-format>
Elements appear as: [nodeId] <indicator> <tag> "text" context

Legend:
- [nodeId]: Use this number in click/type calls
- <C>/<T>: Clickable or Typeable
</element-format>
${guidelines}
</execution-instructions>`
  }

  private _buildPlannerExecutionHistory(): string {
    if (this.plannerExecutionHistory.length === 0) {
      return "No execution history yet"
    }

    return this.plannerExecutionHistory.map((entry) => {
      let plannerSection = ""

      if ('summary' in entry.plannerOutput) {
        const summary = entry.plannerOutput as ExecutionHistorySummary
        const iterationNumber = entry.plannerIterations

        return `=== ITERATIONS 1-${iterationNumber} SUMMARY ===\n${summary.summary}`
      }

      if (!('todoMarkdown' in entry.plannerOutput)) {
        // Dynamic planner output
        const plan = entry.plannerOutput as PlannerOutput
        plannerSection = `PLANNER OUTPUT:
- Task: ${plan.userTask}
- Current State: ${plan.currentState}
- Execution History: ${plan.executionHistory}
- Challenges Identified: ${plan.challengesIdentified}
- Reasoning: ${plan.stepByStepReasoning}
- Actions Planned: ${plan.proposedActions.join(', ')}`
      } else {
        // Predefined planner output
        const plan = entry.plannerOutput as PredefinedPlannerOutput
        plannerSection = `PLANNER OUTPUT:
- User Task: ${plan.userTask}
- Execution History: ${plan.executionHistory}
- Current State: ${plan.currentState}
- Challenges Identified: ${plan.challengesIdentified}
- Reasoning: ${plan.stepByStepReasoning}
- TODO Markdown: ${plan.todoMarkdown}
- Proposed Actions: ${plan.proposedActions.join(', ')}`
      }

      const toolSection = entry.toolMessages.length > 0
        ? `TOOL EXECUTIONS:\n${entry.toolMessages.join('\n')}`
        : "No tool executions"

      const iterationNumber = entry.plannerIterations

      return `=== ITERATION ${iterationNumber} ===\n${plannerSection}\n\n${toolSection}`
    }).join('\n\n')
  }

  private async _summarizeExecutionHistory(history: string): Promise<ExecutionHistorySummary> {
    const llm = await getLLM({
      temperature: 0.2,
      maxTokens: 4096,
    })
    const structuredLLM = llm.withStructuredOutput(ExecutionHistorySummarySchema)
    const systemPrompt = generateExecutionHistorySummaryPrompt()
    const userPrompt = `Execution History: ${history}`
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]
    const result = await invokeWithRetry<ExecutionHistorySummary>(structuredLLM, messages, 3, { signal: this.executionContext.abortSignal })
    return result
  }

  protected _cleanup(): void {
    super._cleanup()
    this.plannerExecutionHistory = []
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
}
