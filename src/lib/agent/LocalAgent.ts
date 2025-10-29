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
import { HumanInputResponse, PubSubEvent } from "@/lib/pubsub/types";
import { Logging } from "@/lib/utils/Logging";
import { AbortError } from "@/lib/utils/Abortable";
import { jsonParseToolOutput } from "@/lib/utils/utils";
import { isDevelopmentMode } from "@/config";
import { invokeWithRetry } from "@/lib/utils/retryable";
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
  GrepElementsTool,
  CelebrationTool,
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

// Constants
const MAX_PLANNER_ITERATIONS = 50;
const MAX_EXECUTOR_ITERATIONS = 3;
const MAX_PREDEFINED_PLAN_ITERATIONS = 30;
const MAX_RETRIES = 3;

// Human input constants
const HUMAN_INPUT_TIMEOUT = 600000;  // 10 minutes
const HUMAN_INPUT_CHECK_INTERVAL = 500;  // Check every 500ms

// Simplified planner output type
interface PlannerOutput {
  reasoning: string;
  proposedActions: string;
  taskComplete: boolean;
  finalAnswer: string;
}


// Predefined planner output type
interface PredefinedPlannerOutput {
  reasoning: string;
  todoMarkdown: string;
  proposedActions: string;
  taskComplete: boolean;
  finalAnswer: string;
}


// Execution history summary type
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

interface SingleTurnResult {
  doneToolCalled: boolean;
  requirePlanningCalled: boolean;
  requiresHumanInput: boolean;
}

// ===== END PARSING FUNCTIONS =====

export class LocalAgent {
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
  private executorLlmWithTools: Runnable<
    BaseLanguageModelInput,
    AIMessageChunk
  > | null = null; // Pre-bound LLM with tools

  // Execution state
  private iterations: number = 0;

  // Planner context - accumulates across all iterations
  private plannerExecutionHistory: Array<{
    plannerOutput: PlannerOutput | PredefinedPlannerOutput | ExecutionHistorySummary;
    toolMessages: string[];
    plannerIterations: number;
  }> = [];
  private toolDescriptions: string = "";

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.toolManager = new ToolManager(executionContext);
    this.glowService = GlowAnimationService.getInstance();
    Logging.log("LocalAgent", "Agent instance created", "info");
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
      "LocalAgent",
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
    this.toolManager.register(ExtractTool(this.executionContext)); // Extract text from page
    this.toolManager.register(HumanInputTool(this.executionContext));
    this.toolManager.register(CelebrationTool(this.executionContext)); // Celebration/confetti tool
    this.toolManager.register(DateTool(this.executionContext)); // Date/time utilities
    this.toolManager.register(BrowserOSInfoTool(this.executionContext)); // BrowserOS info tool

    // External integration tools
    this.toolManager.register(MCPTool(this.executionContext)); // MCP server integration

    this.toolManager.register(GrepElementsTool(this.executionContext)); // Search elements when browser state is truncated

    // Completion tool
    this.toolManager.register(DoneTool(this.executionContext));

    // Populate tool descriptions after all tools are registered
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

  // There are basically two modes of operation:
  // 1. Dynamic planning - the agent plans and executes in a loop until done
  // 2. Predefined plan - the agent executes a predefined set of steps in a loop until all are done
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
    this._publishMessage(
      `Executing agent: ${plan.name || 'Custom Agent'}`,
      "thinking"
    );

    // Add goal for context
    const goalMessage = plan.goal || task;

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
        this._publishMessage(finalMessage, 'assistant');
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

      // This will be handled in _runExecutor with fresh message manager

      // Execute the actions
      const executorResult = await this._runExecutor(plan.proposedActions, plan);

      // Handle human input if needed
      if (executorResult.requiresHumanInput) {
        const humanResponse = await this._waitForHumanInput();
        if (humanResponse === 'abort') {
          this._publishMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }
        this._publishMessage('✅ Human completed manual action. Continuing...', 'thinking');
        // Note: Human input response will be included in next iteration's planner context
        this.executionContext.clearHumanInputState();
      }

    }

    // Check if we hit iteration limit
    if (!allComplete && this.iterations >= MAX_PREDEFINED_PLAN_ITERATIONS) {
      this._publishMessage(
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
    this._publishMessage("Starting task execution...", "thinking");

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
      // CRITICAL: Flush any queued messages from planning

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
      this.pubsub.publishMessage(
        PubSub.createMessage(plan.reasoning, "thinking"),
      );

      // Check if task is complete
      if (plan.taskComplete) {
        done = true;
        // Use final answer if provided, otherwise fallback
        const completionMessage =
          plan.finalAnswer || "Task completed successfully";
        // Publish final result with 'assistant' role to match LocalAgent pattern
        this.pubsub.publishMessage(PubSub.createMessage(completionMessage, "assistant"));
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

      // This will be handled in _runExecutor with fresh message manager

      const executorResult = await this._runExecutor(plan.proposedActions, plan);

      // Check execution outcomes
      if (executorResult.requiresHumanInput) {
        // Human input requested - wait for response
        const humanResponse = await this._waitForHumanInput();
        
        if (humanResponse === 'abort') {
          // Human aborted the task
          this._publishMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }
        
        // Human clicked "Done" - continue with next planning iteration
        this._publishMessage('✅ Human completed manual action. Re-planning...', 'thinking');
        // Note: Human input response will be included in next iteration's planner context

        // Clear human input state
        this.executionContext.clearHumanInputState();
      }
    }

    // Check if we hit planning iteration limit
    if (!done && this.iterations >= MAX_PLANNER_ITERATIONS) {
      this._publishMessage(
        `Task did not complete within ${MAX_PLANNER_ITERATIONS} planning iterations`,
        "error",
      );
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
    browserStateTokensLimit: number = 50000
  ): Promise<HumanMessage> {
    let browserStateString: string | null = null;

    if (includeBrowserState) {
      browserStateString = await this.executionContext.browserContext.getBrowserStateString(
        simplified,
      );

      // check if browser state string exceed 50% of model's max tokens
      const tokens = TokenCounter.countMessage(new HumanMessage(browserStateString));
      if (tokens > browserStateTokensLimit) {
        // if it exceeds, first remove Hidden Elements from browser state string
        browserStateString = await this.executionContext.browserContext.getBrowserStateString(
          simplified,
          true // hide hidden elements
        );
        // then again check if it still exceeds 50% of model's max tokens, if it does, truncate the string to 50% of model's max tokens
        const tokens = TokenCounter.countMessage(new HumanMessage(browserStateString));
        if (tokens > browserStateTokensLimit) {
            // Calculate the ratio to truncate by
            const truncationRatio = browserStateTokensLimit / tokens;
            
            // Truncate the string (rough approximation based on character length)
            const targetLength = Math.floor(browserStateString.length * truncationRatio);
            browserStateString = browserStateString.substring(0, targetLength);
            
            // Optional: Add truncation indicator
            browserStateString += "\n\n-- IMPORTANT: TRUNCATED DUE TO TOKEN LIMIT, USE GREP ELEMENTS TOOL TO SEARCH FOR ELEMENTS IF NEEDED --\n";
        }
      }
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
        // No tool calls, might be done or ask for planner output
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
              this.pubsub.publishMessage(
                PubSub.createMessageWithId(
                  currentMsgId,
                  "Processing...",
                  "thinking",
                ),
              );
            }
            
            // Queue warning for agent's next iteration
            mm.queueSystemReminder(
              "I will never output <browser-state> or <system-reminder> tags or their contents. These are for my internal reference only. If I have completed all actions, I will complete the task and call 'done' tool."
            );
            
            // Log for debugging
            Logging.log("LocalAgent", 
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
            currentMsgId = PubSub.generateId("msg_assistant");
          }

          // Publish/update the message with accumulated content in real-time
          if (currentMsgId) {
            this.pubsub.publishMessage(
              PubSub.createMessageWithId(
                currentMsgId,
                accumulatedText,
                "thinking",
              ),
            );
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
      // Final publish with complete message
      this.pubsub.publishMessage(
        PubSub.createMessageWithId(currentMsgId, accumulatedText, "thinking"),
      );
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

      this._emitDevModeDebug(`Calling tool ${toolName} with args`, JSON.stringify(args));

      // Start glow animation for visual tools
      await this._maybeStartGlowAnimation(toolName);

      const tool = this.toolManager.get(toolName);

      let toolResult: string;
      if (!tool) {
        Logging.log("LocalAgent", `Unknown tool: ${toolName}`, "warning");
        const errorMsg = `Unknown tool: ${toolName}`;
        toolResult = JSON.stringify({
          ok: false,
          error: errorMsg,
        });

        this._emitDevModeDebug("Error", errorMsg);
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
            "LocalAgent",
            `Tool ${toolName} execution failed: ${error}`,
            "error",
          );

          this._emitDevModeDebug(`Error executing ${toolName}`, errorMsg);
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

  private _publishMessage(
    content: string,
    type: "thinking" | "assistant" | "error",
  ): void {
    this.pubsub.publishMessage(PubSub.createMessage(content, type as any));
  }

  // Emit debug information in development mode
  private _emitDevModeDebug(action: string, details?: string, maxLength: number = 60): void {
    if (isDevelopmentMode()) {
      let message = action;
      if (details) {
        const truncated = details.length > maxLength 
          ? details.substring(0, maxLength) + "..." 
          : details;
        message = `${action}: ${truncated}`;
      }
      this.pubsub.publishMessage(
        PubSub.createMessage(`[DEV MODE] ${message}`, "thinking"),
      );
    }
  }

  private _handleExecutionError(error: unknown): void {
    if (error instanceof AbortError) {
      Logging.log("LocalAgent", "Execution aborted by user", "info");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    Logging.log("LocalAgent", `Execution error: ${errorMessage}`, "error");

    this._publishMessage(`Error: ${errorMessage}`, "error");
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
      "LocalAgent",
      `Execution complete: ${this.iterations} iterations, ${metrics.toolCalls} tool calls, ` +
        `${metrics.observations} observations, ${metrics.errors} errors, ` +
        `${successRate}% success rate, ${duration}ms duration`,
      "info",
    );

    // Log tool frequency if any tools were called
    if (metrics.toolCalls > 0) {
      Logging.log(
        "LocalAgent",
        `Tool frequency: ${JSON.stringify(toolFrequency)}`,
        "info",
      );
    }

    Logging.logMetric("newagent.execution", {
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
    Logging.log("LocalAgent", "Cleanup complete", "info");
  }

  /**
   * Handle glow animation for tools that interact with the browser
   * @param toolName - Name of the tool being executed
   */
  private async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    // Check if this tool should trigger glow animation
    if (!LocalAgent.GLOW_ENABLED_TOOLS.has(toolName)) {
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
          this._publishMessage('⏱️ Human input timed out after 10 minutes', 'error');
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
      this._publishMessage(plan.todoMarkdown, "thinking");
      this.executionContext.setTodoList(plan.todoMarkdown);

      // Publish reasoning
      this.pubsub.publishMessage(
        PubSub.createMessage(plan.reasoning, "thinking")
      );

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
