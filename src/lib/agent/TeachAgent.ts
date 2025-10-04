import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager, MessageType } from "@/lib/runtime/MessageManager";
import { ToolManager } from "@/lib/tools/ToolManager";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { type ScreenshotSizeKey } from "@/lib/browser/BrowserOSAdapter";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { z } from "zod";
import { getLLM } from "@/lib/llm/LangChainProvider";
import BrowserPage from "@/lib/browser/BrowserPage";
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
  generatePlannerPrompt,
  generatePlannerPromptWithUserTrajectory,
  getToolDescriptions,
  generateExecutionHistorySummaryPrompt,
} from "./TeachAgent.prompt";
import {
  ClickTool,
  TypeTool,
  ClearTool,
  ScrollTool,
  NavigateTool,
  KeyTool,
  WaitTool,
  TabsTool,
  TabOpenTool,
  TabFocusTool,
  TabCloseTool,
  ExtractTool,
  HumanInputTool,
  DoneTool,
  MoondreamVisualClickTool,
  MoondreamVisualTypeTool,
  GroupTabsTool,
  BrowserOSInfoTool,
  GetSelectedTabsTool,
  DateTool,
  MCPTool,
} from "@/lib/tools";
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';
import { TokenCounter } from "../utils/TokenCounter";
import { wrapToolForMetrics } from '@/evals2/EvalToolWrapper';
import { ENABLE_EVALS2 } from '@/config';
import { type SemanticWorkflow } from "@/lib/teach-mode/types";

// Constants
const MAX_PLANNER_ITERATIONS = 50;
const MAX_EXECUTOR_ITERATIONS = 3;

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

export class TeachAgent {
  // Tools that trigger glow animation when executed
  private static readonly GLOW_ENABLED_TOOLS = new Set([
    'click',
    'type',
    'clear',
    'moondream_visual_click',
    'moondream_visual_type',
    'scroll',
    'navigate',
    'key',
    'tab_open',
    'tab_focus',
    'tab_close',
    'extract'
  ]);

  // Core dependencies
  private readonly executionContext: ExecutionContext;
  private readonly toolManager: ToolManager;
  private readonly glowService: GlowAnimationService;
  private readonly mainPubsub: PubSubChannel;  // Main channel for teach-mode events
  private executorLlmWithTools: Runnable<
    BaseLanguageModelInput,
    AIMessageChunk
  > | null = null; // Pre-bound LLM with tools

  // Execution state
  private iterations: number = 0;

  // Planner context - accumulates across all iterations
  private plannerExecutionHistory: Array<{
    plannerOutput: PlannerOutput | ExecutionHistorySummary;
    toolMessages: string[];
    plannerIterations: number;
  }> = [];
  private toolDescriptions: string = getToolDescriptions();

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.toolManager = new ToolManager(executionContext);
    this.glowService = GlowAnimationService.getInstance();
    this.mainPubsub = PubSub.getChannel('main');  // Get main channel for teach-mode events
    Logging.log("TeachAgent", "TeachAgent instance created", "info");
  }

  private get executorMessageManager(): MessageManager {
    return this.executionContext.messageManager;
  }

  private get pubsub(): PubSubChannel {
    return this.executionContext.getPubSub();
  }

  private checkIfAborted(): void {
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError();
    }
  }

  // Helper method to emit teach-mode events
  private _emitTeachModeEvent(
    eventType: TeachModeEventPayload['eventType'],
    data: any
  ): void {
    this.mainPubsub.publishTeachModeEvent({
      eventType,
      sessionId: this.executionContext.executionId,
      data
    });
  }

  // Helper method to emit thinking events with stable msgId
  private _emitThinking(msgId: string, content: string): void {
    this._emitTeachModeEvent('execution_thinking', {
      msgId,
      content,
      timestamp: Date.now()
    });
  }

  private async _initialize(): Promise<void> {
    // Register tools FIRST (before binding)
    await this._registerTools();

    // Create LLM with consistent temperature
    const llm = await getLLM({
      temperature: 0.2,
      maxTokens: 4096,
    });

    // Validate LLM supports tool binding
    if (!llm.bindTools || typeof llm.bindTools !== "function") {
      throw new Error("This LLM does not support tool binding");
    }

    // Bind tools ONCE and store the bound LLM
    this.executorLlmWithTools = llm.bindTools(this.toolManager.getAll());

    // Reset state
    this.iterations = 0;

    Logging.log(
      "TeachAgent",
      `Initialization complete with ${this.toolManager.getAll().length} tools bound`,
      "info",
    );
  }

  private async _registerTools(): Promise<void> {
    // Core interaction tools
    this.toolManager.register(ClickTool(this.executionContext)); // NodeId-based click
    this.toolManager.register(TypeTool(this.executionContext)); // NodeId-based type
    this.toolManager.register(ClearTool(this.executionContext)); // NodeId-based clear

    // Visual fallback tools (Moondream-powered)
    this.toolManager.register(MoondreamVisualClickTool(this.executionContext)); // Visual click fallback
    this.toolManager.register(MoondreamVisualTypeTool(this.executionContext)); // Visual type fallback

    // Navigation and utility tools
    this.toolManager.register(ScrollTool(this.executionContext));
    this.toolManager.register(NavigateTool(this.executionContext));
    this.toolManager.register(KeyTool(this.executionContext));
    this.toolManager.register(WaitTool(this.executionContext));

    // Planning/Todo tools
    // this.toolManager.register(TodoSetTool(this.executionContext));
    // this.toolManager.register(TodoGetTool(this.executionContext));

    // Tab management tools
    this.toolManager.register(TabsTool(this.executionContext));
    this.toolManager.register(TabOpenTool(this.executionContext));
    this.toolManager.register(TabFocusTool(this.executionContext));
    this.toolManager.register(TabCloseTool(this.executionContext));
    this.toolManager.register(GroupTabsTool(this.executionContext)); // Group tabs together
    this.toolManager.register(GetSelectedTabsTool(this.executionContext)); // Get selected tabs

    // Utility tools
    this.toolManager.register(ExtractTool(this.executionContext));
    this.toolManager.register(HumanInputTool(this.executionContext));
    this.toolManager.register(DateTool(this.executionContext)); // Date/time utilities
    this.toolManager.register(BrowserOSInfoTool(this.executionContext)); // BrowserOS info tool

    // External integration tools
    this.toolManager.register(MCPTool(this.executionContext)); // MCP server integration

    // Completion tool
    this.toolManager.register(DoneTool(this.executionContext));

    Logging.log(
      "TeachAgent",
      `Registered ${this.toolManager.getAll().length} tools`,
      "info",
    );
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
      try {
        // Get all active glow tabs from the service
        const activeGlows = await this.glowService.getAllActiveGlows();
        for (const tabId of activeGlows) {
          await this.glowService.stopGlow(tabId);
        }
      } catch (error) {
        console.error(`Could not stop glow animation: ${error}`);
      }
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

    // Publish execution started event
    this._emitTeachModeEvent('execution_started', {
      workflowId: workflow.metadata.recordingId || '',
      goal: workflow.metadata.goal,
      totalSteps: workflow.steps.length
    });

    while (!done && this.iterations < MAX_PLANNER_ITERATIONS) {
      this.checkIfAborted();
      this.iterations++;

      Logging.log(
        "TeachAgent",
        `Planning iteration ${this.iterations}/${MAX_PLANNER_ITERATIONS}`,
        "info",
      );

      // Get reasoning and high-level actions
      const planResult = await this._runDynamicPlanner(workflow);
      // CRITICAL: Flush any queued messages from planning

      if (!planResult.ok) {
        Logging.log(
          "TeachAgent",
          `Planning failed: ${planResult.error}`,
          "error",
        );
        continue;
      }

      const plan = planResult.output!;

      // Publish reasoning as teach-mode-event for UI display with unique msgId
      const thinkingMsgId = PubSub.generateId('teach_thinking');
      this._emitThinking(thinkingMsgId, plan.stepByStepReasoning);

      // Check if task is complete
      if (plan.taskComplete) {
        done = true;
        // Use final answer if provided, otherwise fallback
        const completionMessage =
          plan.finalAnswer || "Task completed successfully";

        // Publish execution completed event
        this.mainPubsub.publishTeachModeEvent({
          eventType: 'execution_completed',
          sessionId: this.executionContext.executionId,
          data: {
            workflowId: workflow.metadata.recordingId || '',
            success: true,
            message: completionMessage
          }
        });
        break;
      }

      // Validate we have actions if not complete
      if (!plan.proposedActions || plan.proposedActions.length === 0) {
        Logging.log(
          "NewAgent",
          "Planner provided no actions but task not complete",
          "warning",
        );
        continue;
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
          this.pubsub.publishMessage(PubSub.createMessage('Task aborted by human', 'assistant'));
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
      this._emitTeachModeEvent('execution_failed', {
        error: `Maximum planning iterations (${MAX_PLANNER_ITERATIONS}) reached`,
        reason: 'iteration_limit'
      });
      throw new Error(
        `Maximum planning iterations (${MAX_PLANNER_ITERATIONS}) reached`,
      );
    }
  }

  private async _getBrowserStateMessage(
    includeScreenshot: boolean,
    simplified: boolean = true,
    screenshotSize: ScreenshotSizeKey = "large",
    includeBrowserState: boolean = true,
  ): Promise<HumanMessage> {
    let browserStateString: string | null = null;

    if (includeBrowserState) {
      browserStateString = await this.executionContext.browserContext.getBrowserStateString(
        simplified,
      );
    }

    if (includeScreenshot && this.executionContext.supportsVision()) {
      // Get current page and take screenshot
      const page = await this.executionContext.browserContext.getCurrentPage();
      const screenshot = await page.takeScreenshot(screenshotSize, includeBrowserState);

      if (screenshot) {
        // Build content array based on what is included
        const content: any[] = [];
        if (includeBrowserState && browserStateString !== null) {
          content.push({ type: "text", text: `<browser-state>${browserStateString}</browser-state>` });
        }
        content.push({ type: "image_url", image_url: { url: screenshot } });

        const message = new HumanMessage({
          content,
        });
        // Tag this as a browser state message for proper handling in MessageManager
        message.additional_kwargs = { messageType: MessageType.BROWSER_STATE };
        return message;
      }
    }

    // If only browser state is requested or screenshot failed/unavailable
    if (includeBrowserState && browserStateString !== null) {
      const message = new HumanMessage(`<browser-state>${browserStateString}</browser-state>`);
      message.additional_kwargs = { messageType: MessageType.BROWSER_STATE };
      return message;
    }

    // If neither browser state nor screenshot is included, return a minimal message
    const message = new HumanMessage("");
    message.additional_kwargs = { messageType: MessageType.BROWSER_STATE };
    return message;
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
        const toolsResult = await this._processToolCalls(
          llmResponse.tool_calls,
          executorMM,
          currentIterationToolMessages
        );

        // Update iteration count and metrics
        // this.iterations += llmResponse.tool_calls.length;
        for (const toolCall of llmResponse.tool_calls) {
          this.executionContext.incrementMetric("toolCalls");
          this.executionContext.incrementToolUsageMetrics(toolCall.name);
        }

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

  private async _invokeLLMWithStreaming(messageManager?: MessageManager): Promise<AIMessage> {
    const mm = messageManager || this.executorMessageManager;
    // Use the pre-bound LLM (created and bound once during initialization)
    if (!this.executorLlmWithTools) {
      throw new Error("LLM not initialized - ensure _initialize() was called");
    }

    // Tags that should never be output to users
    const PROHIBITED_TAGS = [
      '<browser-state>',
      '<system-reminder>',
      '</browser-state>',
      '</system-reminder>'
    ];

    const message_history = mm.getMessages();

    const stream = await this.executorLlmWithTools.stream(message_history, {
      signal: this.executionContext.abortSignal,
    });

    let accumulatedChunk: AIMessageChunk | undefined;
    let accumulatedText = "";
    let hasStartedThinking = false;
    let currentMsgId: string | null = null;
    let hasProhibitedContent = false;

    for await (const chunk of stream) {
      this.checkIfAborted(); // Manual check during streaming

      if (chunk.content && typeof chunk.content === "string") {
        // Accumulate text first
        accumulatedText += chunk.content;

        // Check for prohibited tags if not already detected
        if (!hasProhibitedContent) {
          const detectedTag = PROHIBITED_TAGS.find(tag => accumulatedText.includes(tag));
          if (detectedTag) {
            hasProhibitedContent = true;
            
            // If we were streaming, replace with "Processing..."
            if (currentMsgId) {
              this._emitThinking(currentMsgId, "Processing...");
            }
            
            // Queue warning for agent's next iteration
            mm.queueSystemReminder(
              "I will never output <browser-state> or <system-reminder> tags or their contents. These are for my internal reference only. If I have completed all actions, I will complete the task and call 'done' tool."
            );
            
            // Log for debugging
            Logging.log("TeachAgent", 
              "LLM output contained prohibited tags, streaming stopped", 
              "warning"
            );
            
            // Increment error metric
            this.executionContext.incrementMetric("errors");
          }
        }

        // Only stream to UI if no prohibited content detected
        if (!hasProhibitedContent) {
          // Start thinking on first real content
          if (!hasStartedThinking) {
            hasStartedThinking = true;
            // Create message ID on first content chunk
            currentMsgId = PubSub.generateId("teach_exec_thinking");
          }

          // Emit thinking event with same msgId for updates
          if (currentMsgId) {
            this._emitThinking(currentMsgId, accumulatedText);
          }
        }
      }
      
      // Always accumulate chunks for final AIMessage (even with prohibited content)
      accumulatedChunk = !accumulatedChunk
        ? chunk
        : accumulatedChunk.concat(chunk);
    }

    // Only finish thinking if we started, have clean content, and have a message ID
    if (hasStartedThinking && !hasProhibitedContent && accumulatedText.trim() && currentMsgId) {
      // Final emit with complete message
      this._emitThinking(currentMsgId, accumulatedText);
    }

    if (!accumulatedChunk) return new AIMessage({ content: "" });

    // Convert the final chunk back to a standard AIMessage
    return new AIMessage({
      content: accumulatedChunk.content,
      tool_calls: accumulatedChunk.tool_calls,
    });
  }

  private async _processToolCalls(
    toolCalls: any[],
    messageManager: MessageManager,
    toolMessages: string[]
  ): Promise<SingleTurnResult> {
    const result: SingleTurnResult = {
      doneToolCalled: false,
      requirePlanningCalled: false,
      requiresHumanInput: false,
    };

    for (const toolCall of toolCalls) {
      this.checkIfAborted();

      const { name: toolName, args, id: toolCallId } = toolCall;

      this._emitDebug(`Calling tool ${toolName} with args`, JSON.stringify(args));

      // Start glow animation for visual tools
      await this._maybeStartGlowAnimation(toolName);

      const tool = this.toolManager.get(toolName);

      let toolResult: string;
      if (!tool) {
        Logging.log("TeachAgent", `Unknown tool: ${toolName}`, "warning");
        const errorMsg = `Unknown tool: ${toolName}`;
        toolResult = JSON.stringify({
          ok: false,
          error: errorMsg,
        });

        this._emitDebug("Error", errorMsg);
      } else {
        try {
          // Execute tool (wrap for evals2 metrics if enabled)
          let toolFunc = tool.func;
          if (ENABLE_EVALS2) {
            const wrapped = wrapToolForMetrics(tool, this.executionContext, toolCallId);
            toolFunc = wrapped.func;
          }
          toolResult = await toolFunc(args);

        } catch (error) {
          // Even on execution error, we must add a tool result
          const errorMsg = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
          toolResult = JSON.stringify({
            ok: false,
            error: errorMsg,
          });

          // Increment error metric
          this.executionContext.incrementMetric("errors");

          Logging.log(
            "TeachAgent",
            `Tool ${toolName} execution failed: ${error}`,
            "error",
          );

          this._emitDebug(`Error executing ${toolName}`, errorMsg);
        }
      }

      // Parse result to check for special flags
      const parsedResult = jsonParseToolOutput(toolResult);

      // Add to message manager and track tool message
      messageManager.addTool(toolResult, toolCallId);
      toolMessages.push(`Tool: ${toolName} - Result: ${toolResult}`);

      // Check for special tool outcomes but DON'T break early
      // We must process ALL tool calls to ensure all get responses
      if (toolName === "done" && parsedResult.ok) {
        result.doneToolCalled = true;
      }

      if (
        toolName === "human_input" &&
        parsedResult.ok &&
        parsedResult.requiresHumanInput
      ) {
        result.requiresHumanInput = true;
      }
    }

    // Flush any queued messages from tools (screenshots, browser states, etc.)
    // This is from NewAgent and is CRITICAL for API's required ordering
    messageManager.flushQueue();

    return result;
  }


  // Emit debug information in development mode
  private _emitDebug(action: string, details?: any, maxLength: number = 200): void {
    if (!isDevelopmentMode()) return;

    let message = `[TeachAgent] ${action}`;
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
      message = `${message}: ${detailString}`;
    }

    // Use teach-mode event for dev debug
    const debugMsgId = PubSub.generateId('teach_debug');
    this._emitThinking(debugMsgId, `[DEV MODE] ${message}`);

    // Also log to console for development
    Logging.log("TeachAgent", message, "info");
  }

  private _handleExecutionError(error: unknown): void {
    if (error instanceof AbortError) {
      Logging.log("TeachAgent", "Execution aborted by user", "info");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    Logging.log("TeachAgent", `Execution error: ${errorMessage}`, "error");

    // Publish execution failed event
    this._emitTeachModeEvent('execution_failed', {
      error: errorMessage
    });
  }

  private _logMetrics(): void {
    const metrics = this.executionContext.getExecutionMetrics();
    const duration = metrics.endTime - metrics.startTime;
    const successRate =
      metrics.toolCalls > 0
        ? (
            ((metrics.toolCalls - metrics.errors) / metrics.toolCalls) *
            100
          ).toFixed(1)
        : "0";

    // Convert tool frequency Map to object for logging
    const toolFrequency: Record<string, number> = {};
    metrics.toolFrequency.forEach((count, toolName) => {
      toolFrequency[toolName] = count;
    });

    Logging.log(
      "TeachAgent",
      `Execution complete: ${this.iterations} iterations, ${metrics.toolCalls} tool calls, ` +
        `${metrics.observations} observations, ${metrics.errors} errors, ` +
        `${successRate}% success rate, ${duration}ms duration`,
      "info",
    );

    // Log tool frequency if any tools were called
    if (metrics.toolCalls > 0) {
      Logging.log(
        "TeachAgent",
        `Tool frequency: ${JSON.stringify(toolFrequency)}`,
        "info",
      );
    }

    Logging.logMetric("teachagent.execution", {
      iterations: this.iterations,
      toolCalls: metrics.toolCalls,
      observations: metrics.observations,
      errors: metrics.errors,
      duration,
      successRate: parseFloat(successRate),
      toolFrequency,
    });
  }

  private _cleanup(): void {
    this.iterations = 0;
    this.plannerExecutionHistory = [];
    Logging.log("TeachAgent", "Cleanup complete", "info");
  }

  /**
   * Handle glow animation for tools that interact with the browser
   * @param toolName - Name of the tool being executed
   */
  private async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    // Check if this tool should trigger glow animation
    if (!TeachAgent.GLOW_ENABLED_TOOLS.has(toolName)) {
      return false;
    }

    try {
      const currentPage = await this.executionContext.browserContext.getCurrentPage();
      const tabId = currentPage.tabId;
      
      if (tabId && !this.glowService.isGlowActive(tabId)) {
        await this.glowService.startGlow(tabId);
        return true;
      }
      return false;
    } catch (error) {
      // Log but don't fail if we can't manage glow
      console.error(`Could not manage glow for tool ${toolName}: ${error}`);
      return false;
    }
  }

  /**
   * Wait for human input with timeout
   * @returns 'done' if human clicked Done, 'abort' if clicked Skip/Abort, 'timeout' if timed out
   */
  private async _waitForHumanInput(): Promise<'done' | 'abort' | 'timeout'> {
    const startTime = Date.now();
    const requestId = this.executionContext.getHumanInputRequestId();
    
    if (!requestId) {
      console.error('No human input request ID found');
      return 'abort';
    }
    
    // Subscribe to human input responses
    const subscription = this.pubsub.subscribe((event: PubSubEvent) => {
      if (event.type === 'human-input-response') {
        const response = event.payload as HumanInputResponse;
        if (response.requestId === requestId) {
          this.executionContext.setHumanInputResponse(response);
        }
      }
    });
    
    try {
      // Poll for response or timeout
      while (!this.executionContext.shouldAbort()) {
        // Check if response received
        const response = this.executionContext.getHumanInputResponse();
        if (response) {
          return response.action;  // 'done' or 'abort'
        }
        
        // Check timeout
        if (Date.now() - startTime > HUMAN_INPUT_TIMEOUT) {
          const timeoutMsgId = PubSub.generateId('teach_thinking');
          this._emitThinking(timeoutMsgId, 'Human input timed out after 10 minutes');
          return 'timeout';
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, HUMAN_INPUT_CHECK_INTERVAL));
      }
      
      // Aborted externally
      return 'abort';
      
    } finally {
      // Clean up subscription
      subscription.unsubscribe();
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
   * Build execution context for current iteration
   */
  private _buildExecutionContext(
    plannerOutput: PlannerOutput | null = null,
    actions: string[] | null = null,
  ): string {
    return this._buildDynamicExecutionContext(plannerOutput as PlannerOutput | null, actions);
  }

  /**
   * Build execution context for predefined plans
   */
  private _buildPredefinedExecutionContext(
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
  - Call 'done' when the current actions are completed
</execution-guidelines>`
      : `<execution-guidelines>
  - Use the text-based browser state as your primary reference
  - Match elements by their text content and attributes
  - Batch multiple tool calls in one response when possible (reduces latency)
  - Call 'done' when the current actions are completed
</execution-guidelines>`;

    let predefinedPlanContext = '';
    if (plan) {
      predefinedPlanContext = `<predefined-plan-context>
  <userTask>${plan.userTask}</userTask>
  <executionHistory>${plan.executionHistory}</executionHistory>
  <currentState>${plan.currentState}</currentState>
  <challengesIdentified>${plan.challengesIdentified}</challengesIdentified>
  <reasoning>${plan.stepByStepReasoning}</reasoning>
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
  private _buildDynamicExecutionContext(
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

