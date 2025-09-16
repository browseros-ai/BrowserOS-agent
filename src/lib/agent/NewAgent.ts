import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager, MessageManagerReadOnly, MessageType } from "@/lib/runtime/MessageManager";
import { ToolManager } from "@/lib/tools/ToolManager";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { type ScreenshotSizeKey } from "@/lib/browser/BrowserOSAdapter";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
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
import { TokenCounter } from "@/lib/utils/TokenCounter";
import {
  generateExecutorPrompt,
  generatePlannerPrompt,
  generatePredefinedPlannerPrompt,
} from "./NewAgent.prompt";
import {
  createClickTool,
  createTypeTool,
  createClearTool,
  createScrollTool,
  createNavigateTool,
  createKeyTool,
  createWaitTool,
  createTodoSetTool,
  createTodoGetTool,
  createTabsTool,
  createTabOpenTool,
  createTabFocusTool,
  createTabCloseTool,
  createExtractTool,
  createHumanInputTool,
  createDoneTool,
  createMoondreamVisualClickTool,
  createMoondreamVisualTypeTool,
} from "@/lib/tools/NewTools";
import { createGroupTabsTool } from "@/lib/tools/tab/GroupTabsTool";
import { createGetSelectedTabsTool } from "@/lib/tools/tab/GetSelectedTabsTool";
import { createDateTool } from "@/lib/tools/utility/DateTool";
import { createMCPTool } from "@/lib/tools/mcp/MCPTool";
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';

// Constants
const MAX_PLANNER_ITERATIONS = 50;
const MAX_EXECUTOR_ITERATIONS = 3;
const MAX_PREDEFINED_PLAN_ITERATIONS = 30;

// Human input constants
const HUMAN_INPUT_TIMEOUT = 600000;  // 10 minutes
const HUMAN_INPUT_CHECK_INTERVAL = 500;  // Check every 500ms

// Standard planner output schema
const PlannerOutputSchema = z.object({
  observation: z
    .string()
    .describe("Brief analysis of current state and what has been done so far"),
  reasoning: z
    .string()
    .describe(
      "Explain your reasoning for suggested actions or completion decision",
    ),
  challenges: z
    .string()
    .describe("Any potential challenges or roadblocks identified"),
  actions: z
    .array(z.string())
    .max(5)
    .describe(
      "High-level actions to execute next (empty if taskComplete=true)",
    ),
  taskComplete: z.boolean().describe("Is the overall task complete?"),
  finalAnswer: z
    .string()
    .describe(
      "Complete user-friendly answer when task is done (empty if taskComplete=false)",
    ),
});

type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

// Predefined planner output schema - uses TODO markdown for tracking
const PredefinedPlannerOutputSchema = z.object({
  todoMarkdown: z
    .string()
    .describe("Updated TODO list with completed items marked [x]"),
  observation: z
    .string()
    .describe("What happened in last execution"),
  reasoning: z
    .string()
    .describe("Why these actions will complete current TODO"),
  actions: z
    .array(z.string())
    .max(5)
    .describe("Actions to execute for current TODO"),
  allTodosComplete: z
    .boolean()
    .describe("Are all TODOs complete?"),
  finalAnswer: z
    .string()
    .describe("Summary when all TODOs complete (empty if not done)"),
});

type PredefinedPlannerOutput = z.infer<typeof PredefinedPlannerOutputSchema>;

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

export class NewAgent {
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
  private page: BrowserPage | null = null;

  // Execution state
  private iterations: number = 0;

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.toolManager = new ToolManager(executionContext);
    this.glowService = GlowAnimationService.getInstance();
    Logging.log("NewAgent", "Agent instance created", "info");
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
    // Get current browser page
    this.page = await this.executionContext.browserContext.getCurrentPage();

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
      "NewAgent",
      `Initialization complete with ${this.toolManager.getAll().length} tools bound`,
      "info",
    );
  }

  private async _registerTools(): Promise<void> {
    // Core interaction tools
    this.toolManager.register(createClickTool(this.executionContext)); // NodeId-based click
    this.toolManager.register(createTypeTool(this.executionContext)); // NodeId-based type
    this.toolManager.register(createClearTool(this.executionContext)); // NodeId-based clear

    // Visual fallback tools (Moondream-powered)
    this.toolManager.register(createMoondreamVisualClickTool(this.executionContext)); // Visual click fallback
    this.toolManager.register(createMoondreamVisualTypeTool(this.executionContext)); // Visual type fallback

    // Navigation and utility tools
    this.toolManager.register(createScrollTool(this.executionContext));
    this.toolManager.register(createNavigateTool(this.executionContext));
    this.toolManager.register(createKeyTool(this.executionContext));
    this.toolManager.register(createWaitTool(this.executionContext));

    // Planning/Todo tools
    // this.toolManager.register(createTodoSetTool(this.executionContext));
    // this.toolManager.register(createTodoGetTool(this.executionContext));

    // Tab management tools
    this.toolManager.register(createTabsTool(this.executionContext));
    this.toolManager.register(createTabOpenTool(this.executionContext));
    this.toolManager.register(createTabFocusTool(this.executionContext));
    this.toolManager.register(createTabCloseTool(this.executionContext));
    this.toolManager.register(createGroupTabsTool(this.executionContext)); // Group tabs together
    this.toolManager.register(createGetSelectedTabsTool(this.executionContext)); // Get selected tabs

    // Utility tools
    this.toolManager.register(createExtractTool(this.executionContext));
    this.toolManager.register(createHumanInputTool(this.executionContext));
    this.toolManager.register(createDateTool(this.executionContext)); // Date/time utilities
    
    // External integration tools
    this.toolManager.register(createMCPTool(this.executionContext)); // MCP server integration

    // Completion tool
    this.toolManager.register(createDoneTool(this.executionContext));

    Logging.log(
      "NewAgent",
      `Registered ${this.toolManager.getAll().length} tools`,
      "info",
    );
  }

  // There are basically two modes of operation:
  // 1. Dynamic planning - the agent plans and executes in a loop until done
  // 2. Predefined plan - the agent executes a predefined set of steps in a loop until all are done
  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    try {
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      });

      Logging.log("NewAgent", `Starting execution`, "info");
      await this._initialize();
      
      // Check for predefined plan
      if (metadata?.executionMode === 'predefined' && metadata.predefinedPlan) {
        await this._executePredefined(task, metadata.predefinedPlan);
      } else {
        await this._executeDynamic(task);
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
    let todoMarkdown = plan.steps.map((step: string) => `- [ ] ${step}`).join('\n');
    this.executionContext.setTodoList(todoMarkdown);

    // executor system prompt
    const systemPrompt = generateExecutorPrompt();
    this.executorMessageManager.addSystem(systemPrompt);

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
    this.executorMessageManager.addHuman(`Goal: ${goalMessage}`);

    let iterations = 0;
    let allComplete = false;

    while (!allComplete && iterations < MAX_PREDEFINED_PLAN_ITERATIONS) {
      this.checkIfAborted();
      iterations++;

      Logging.log(
        "NewAgent",
        `Predefined plan iteration ${iterations}/${MAX_PREDEFINED_PLAN_ITERATIONS}`,
        "info"
      );

      // Run predefined planner with current TODO state
      const planResult = await this._runPredefinedPlanner(task, this.executionContext.getTodoList());

      if (!planResult.ok) {
        Logging.log(
          "NewAgent",
          `Predefined planning failed: ${planResult.error}`,
          "error"
        );
        continue;
      }

      const plan = planResult.output!;

      // Check if all complete
      if (plan.allTodosComplete) {
        allComplete = true;
        const finalMessage = plan.finalAnswer || "All steps completed successfully";
        this._publishMessage(finalMessage, 'assistant');
        break;
      }

      // Validate we have actions
      if (!plan.actions || plan.actions.length === 0) {
        Logging.log(
          "NewAgent",
          "Predefined planner provided no actions but TODOs not complete",
          "warning"
        );
        continue;
      }

      Logging.log(
        "NewAgent",
        `Executing ${plan.actions.length} actions for current TODO`,
        "info"
      );

      // In limited context mode, start fresh for each planning iteration
      if (this.executionContext.isLimitedContextMode()) {
        // Store the system prompt and goal message before clearing
        const messages = this.executorMessageManager.getMessages();
        const systemMessages = messages.filter(msg => msg instanceof SystemMessage);
        // Clear all messages
        this.executorMessageManager.clear();

        // Re-add system prompt and goal
        if (systemMessages.length > 0) {
          this.executorMessageManager.add(systemMessages[0], 0);
        }

        Logging.log(
          "NewAgent",
          "Limited context mode: Reset executor message history",
          "info"
        );
      }

      // Build execution context with planner output
      const executionContext = this._buildPredefinedExecutionContext(plan, plan.actions);
      this.executorMessageManager.addSystemReminder(executionContext);

      // Execute the actions
      const executorResult = await this._runExecutor(plan.actions);

      // Handle human input if needed
      if (executorResult.requiresHumanInput) {
        const humanResponse = await this._waitForHumanInput();
        if (humanResponse === 'abort') {
          this._publishMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }
        this._publishMessage('✅ Human completed manual action. Continuing...', 'thinking');
        this.executorMessageManager.addAI('Human has completed the requested manual action. Continuing with the task.');
        this.executionContext.clearHumanInputState();
      }
    }

    // Check if we hit iteration limit
    if (!allComplete && iterations >= MAX_PREDEFINED_PLAN_ITERATIONS) {
      this._publishMessage(
        `Predefined plan did not complete within ${MAX_PREDEFINED_PLAN_ITERATIONS} iterations`,
        "error"
      );
      throw new Error(
        `Maximum predefined plan iterations (${MAX_PREDEFINED_PLAN_ITERATIONS}) reached`
      );
    }

    Logging.log("NewAgent", `Predefined plan execution complete`, "info");
  }

  private async _executeDynamic(task: string): Promise<void> {
    // Set current task in context
    this.executionContext.setCurrentTask(task);

    // executor system prompt
    const systemPrompt = generateExecutorPrompt();
    this.executorMessageManager.addSystem(systemPrompt);

    // Validate LLM is initialized with tools bound
    if (!this.executorLlmWithTools) {
      throw new Error("LLM with tools not initialized");
    }

    let done = false;
    let plannerIterations = 0;

    // Publish start message
    this._publishMessage("Starting task execution...", "thinking");

    while (!done && plannerIterations < MAX_PLANNER_ITERATIONS) {
      this.checkIfAborted();
      plannerIterations++;

      Logging.log(
        "NewAgent",
        `Planning iteration ${plannerIterations}/${MAX_PLANNER_ITERATIONS}`,
        "info",
      );

      // Get reasoning and high-level actions
      const planResult = await this._runDynamicPlanner(task);
      // CRITICAL: Flush any queued messages from planning
      this.executorMessageManager.flushQueue();

      if (!planResult.ok) {
        Logging.log(
          "NewAgent",
          `Planning failed: ${planResult.error}`,
          "error",
        );
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
        // Publish final result with 'assistant' role to match BrowserAgent pattern
        this.pubsub.publishMessage(PubSub.createMessage(completionMessage, "assistant"));
        break;
      }

      // Validate we have actions if not complete
      if (!plan.actions || plan.actions.length === 0) {
        Logging.log(
          "NewAgent",
          "Planner provided no actions but task not complete",
          "warning",
        );
        continue;
      }

      Logging.log(
        "NewAgent",
        `Executing ${plan.actions.length} actions from plan`,
        "info",
      );

      // In limited context mode, start fresh for each planning iteration
      if (this.executionContext.isLimitedContextMode()) {
        // Store the system prompt before clearing
        const systemMessages = this.executorMessageManager.getMessages().filter(
          msg => msg instanceof SystemMessage
        );

        // Clear all messages
        this.executorMessageManager.clear();

        // Re-add system prompt if it exists
        if (systemMessages.length > 0) {
          this.executorMessageManager.add(systemMessages[0], 0);
        }

        Logging.log(
          "NewAgent",
          "Limited context mode: Reset executor message history",
          "info"
        );
      }

      // Build unified execution context with planning + execution instructions
      const executionContext = this._buildDynamicExecutionContext(plan, plan.actions);
      this.executorMessageManager.addSystemReminder(executionContext);

      const executorResult = await this._runExecutor(plan.actions);

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
        this.executorMessageManager.addAI('Human has completed the requested manual action. Continuing with the task.');
        
        // Clear human input state
        this.executionContext.clearHumanInputState();
        
        // Continue to next planning iteration
      }
    }

    // Check if we hit planning iteration limit
    if (!done && plannerIterations >= MAX_PLANNER_ITERATIONS) {
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
  ): Promise<HumanMessage> {
    // Get browser state string
    const browserStateString =
      await this.executionContext.browserContext.getBrowserStateString(
        simplified,
      );

    if (includeScreenshot && this.executionContext.supportsVision()) {
      // Get current page and take screenshot
      const page = await this.executionContext.browserContext.getCurrentPage();
      const screenshot = await page.takeScreenshot(screenshotSize, true);

      if (screenshot) {
        // Return multimodal message with state + screenshot, properly tagged as browser state
        const message = new HumanMessage({
          content: [
            { type: "text", text: `<browser-state>${browserStateString}</browser-state>` },
            { type: "image_url", image_url: { url: screenshot } },
          ],
        });
        // Tag this as a browser state message for proper handling in MessageManager
        message.additional_kwargs = { messageType: MessageType.BROWSER_STATE };
        return message;
      }
    }

    // Return text-only message tagged as browser state
    const message = new HumanMessage(`<browser-state>${browserStateString}</browser-state>`);
    message.additional_kwargs = { messageType: MessageType.BROWSER_STATE };
    return message;
  }

  private async _runDynamicPlanner(task: string): Promise<PlannerResult> {
    try {
      this.executionContext.incrementMetric("observations");

      // Get browser state message with screenshot
      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision(),
        /* simplified */ true,
        /* screenshotSize */ "large"
      );

      // Get execution metrics for analysis
      const metrics = this.executionContext.getExecutionMetrics();
      const errorRate = metrics.toolCalls > 0
        ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
        : "0";
      const elapsed = Date.now() - metrics.startTime;

      // Check if we're in limited context mode
      const isLimitedContext = this.executionContext.isLimitedContextMode();

      // Get history only if NOT in limited context mode
      let fullHistory = "";
      if (!isLimitedContext) {
        // Get message history
        const readOnlyMM = new MessageManagerReadOnly(this.executorMessageManager);
        fullHistory = readOnlyMM.getFilteredAsString([MessageType.SYSTEM, MessageType.SCREENSHOT, MessageType.BROWSER_STATE]);
      }

      // Get reasoning history for context (always include this as it's lightweight)
      const recentReasoning = this.executionContext.getReasoningHistory(5);

      // Get LLM with structured output
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      });
      const structuredLLM = llm.withStructuredOutput(PlannerOutputSchema);

      // System prompt for planner
      const systemPrompt = generatePlannerPrompt();

      // Build user prompt incrementally
      let userPrompt = `TASK: ${task}\n\n`;

      // Add execution metrics
      userPrompt += `EXECUTION METRICS:\n`;
      userPrompt += `- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)\n`;
      userPrompt += `- Observations taken: ${metrics.observations}\n`;
      userPrompt += `- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds\n`;

      // Add warning flags if needed
      if (parseInt(errorRate) > 30) {
        userPrompt += `⚠️ HIGH ERROR RATE - Current approach may be failing\n`;
      }
      if (metrics.toolCalls > 10 && metrics.errors > 5) {
        userPrompt += `⚠️ MANY ATTEMPTS - May be stuck in a loop\n`;
      }

      // Add full execution history if not in limited context
      if (!isLimitedContext && fullHistory) {
        userPrompt += `\nFULL EXECUTION HISTORY:\n`;
        userPrompt += `${fullHistory}\n\n`;
      }

      // Add reasoning history (always, as it's lightweight)
      if (recentReasoning.length > 0) {
        userPrompt += `YOUR PREVIOUS REASONING (what you thought would work):\n`;
        userPrompt += recentReasoning.map(r => {
          try {
            const parsed = JSON.parse(r);
            return `- ${parsed.reasoning || r}`;
          } catch {
            return `- ${r}`;
          }
        }).join("\n");
        userPrompt += "\n\n";
      }

      // Add analysis instructions if we have history
      if (!isLimitedContext && fullHistory) {
        userPrompt += `ANALYZE the execution history above to understand:\n`;
        userPrompt += `1. What the executor actually attempted (check tool calls and results)\n`;
        userPrompt += `2. What failed and why (check error messages)\n`;
        userPrompt += `3. Whether your previous plan was executed correctly\n\n`;
      }

      // Add final question
      userPrompt += `Based on the `;
      if (!isLimitedContext) {
        userPrompt += `metrics, execution history, and `;
      }
      userPrompt += `current browser state, what should we do next?`;

      // Build messages
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
        browserStateMessage, // Browser state with screenshot
      ];

      // Log token counts for individual messages and total
      this._logMessageTokens(messages, `Dynamic Planner (iteration ${this.executionContext.getExecutionMetrics().observations})`);

      // Get structured response from LLM with retry logic
      const result = await invokeWithRetry<PlannerOutput>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortSignal }
      );

      // Store structured reasoning in context as JSON
      const plannerState = {
        observation: result.observation,
        reasoning: result.reasoning,
        challenges: result.challenges || "",
        taskComplete: result.taskComplete,
        actionsPlanned: result.actions.length,
      };
      this.executionContext.addReasoning(JSON.stringify(plannerState));

      // Log planner decision
      Logging.log(
        "NewAgent",
        result.taskComplete
          ? `Planner: Task complete with final answer`
          : `Planner: ${result.actions.length} actions planned`,
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

  private async _runExecutor(actions: string[]): Promise<ExecutorResult> {
    let executorIterations = 0;
    let isFirstPass = true;

    while (executorIterations < MAX_EXECUTOR_ITERATIONS) {
      this.checkIfAborted();
      executorIterations++;

      // Add browser state and simple prompt
      if (isFirstPass) {
        // Add current browser state without screenshot
        const browserStateMessage = await this._getBrowserStateMessage(
          /* includeScreenshot */ this.executionContext.supportsVision(),
          /* simplified */ false,
          /* screenshotSize */ "medium"
        );
        // remove old state and screenshot messages first
        this.executorMessageManager.removeMessagesByType(MessageType.BROWSER_STATE);
        this.executorMessageManager.removeMessagesByType(MessageType.SCREENSHOT);
        // add new state
        this.executorMessageManager.add(browserStateMessage);

        // Simple prompt - all context is already in system reminder
        this.executorMessageManager.addHuman(
          "Please execute the actions specified in the system reminder above."
        );
        isFirstPass = false;
      } else {
        this.executorMessageManager.addHuman(
          "Please continue or call 'done' tool if all actions are completed.",
        );
      }

      // Get LLM response with tool calls
      const llmResponse = await this._invokeLLMWithStreaming();

      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        // Process tool calls
        this.executorMessageManager.add(llmResponse);
        const toolsResult = await this._processToolCalls(
          llmResponse.tool_calls,
        );

        // Update iteration count and metrics
        this.iterations += llmResponse.tool_calls.length;
        for (const toolCall of llmResponse.tool_calls) {
          this.executionContext.incrementMetric("toolCalls");
          this.executionContext.incrementToolUsageMetrics(toolCall.name);
        }

        // Check for special outcomes
        if (toolsResult.doneToolCalled) {
          return {
            completed: true,
            doneToolCalled: true,
          };
        }

        if (toolsResult.requiresHumanInput) {
          return {
            completed: false,
            requiresHumanInput: true,
          };
        }

        // Continue to next iteration
      } else if (llmResponse.content) {
        // LLM responded with text only
        this.executorMessageManager.addAI(llmResponse.content as string);
        this.executorMessageManager.flushQueue();
      } else {
        // No response, might be done
        break;
      }
    }

    // Hit max iterations without explicit completion
    Logging.log(
      "NewAgent",
      `Executor hit max iterations (${MAX_EXECUTOR_ITERATIONS})`,
      "warning",
    );

    return { completed: false };
  }

  private async _invokeLLMWithStreaming(): Promise<AIMessage> {
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

    const message_history = this.executorMessageManager.getMessages();

    // Log token counts for individual messages and total
    this._logMessageTokens(message_history, `Executor (iteration ${this.iterations + 1})`);

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
            this.executorMessageManager.queueSystemReminder(
              "WARNING: Never output <browser-state> or <system-reminder> tags or their contents. You were doing it now." +
              "These are internal markers only."
            );
            
            // Log for debugging
            Logging.log("NewAgent", 
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

  private async _processToolCalls(toolCalls: any[]): Promise<SingleTurnResult> {
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
        Logging.log("NewAgent", `Unknown tool: ${toolName}`, "warning");
        const errorMsg = `Unknown tool: ${toolName}`;
        toolResult = JSON.stringify({
          ok: false,
          error: errorMsg,
        });

        this._emitDevModeDebug("Error", errorMsg);
      } else {
        try {
          // Execute tool
          toolResult = await tool.func(args);
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
            "NewAgent",
            `Tool ${toolName} execution failed: ${error}`,
            "error",
          );

          this._emitDevModeDebug(`Error executing ${toolName}`, errorMsg);
        }
      }

      // Parse result to check for special flags
      const parsedResult = jsonParseToolOutput(toolResult);
      
      this.executorMessageManager.addTool(toolResult, toolCallId);

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
    this.executorMessageManager.flushQueue();

    return result;
  }

  private _publishMessage(
    content: string,
    type: "thinking" | "assistant" | "error",
  ): void {
    this.pubsub.publishMessage(PubSub.createMessage(content, type as any));
  }

  /**
   * Log token counts for individual messages and total
   * @param messages - Array of messages to log tokens for
   * @param context - Context string for logging (e.g., "Dynamic Planner", "Executor")
   */
  private _logMessageTokens(messages: BaseMessage[], context: string): void {
    // Count tokens for each message
    const messageCounts: string[] = [];
    let totalTokens = 0;

    for (const message of messages) {
      const tokenCount = TokenCounter.countMessage(message);
      totalTokens += tokenCount;

      // Format message type and token count
      const messageType = message.getType();
      if (messageType === 'human') {
        // Check if it's a browser state message
        const isBrowserState = (message as any).additional_kwargs?.messageType === MessageType.BROWSER_STATE;
        if (isBrowserState) {
          messageCounts.push(`HumanMessage (browser-state): ${TokenCounter.format(tokenCount)}`);
        } else {
          messageCounts.push(`HumanMessage: ${TokenCounter.format(tokenCount)}`);
        }
      } else if (messageType === 'system') {
        messageCounts.push(`SystemMessage: ${TokenCounter.format(tokenCount)}`);
      } else if (messageType === 'ai') {
        messageCounts.push(`AIMessage: ${TokenCounter.format(tokenCount)}`);
      } else if (messageType === 'tool') {
        messageCounts.push(`ToolMessage: ${TokenCounter.format(tokenCount)}`);
      } else {
        messageCounts.push(`${messageType}: ${TokenCounter.format(tokenCount)}`);
      }
    }

    // Log to standard logging
    const logMessage = `${context} token usage:\n  ${messageCounts.join('\n  ')}\n  Total: ${TokenCounter.format(totalTokens)}`;
    Logging.log("NewAgent", logMessage, "info");

    // Also emit in dev mode if enabled
    if (isDevelopmentMode()) {
      this._emitDevModeDebug(
        `${context} tokens`,
        `Total: ${TokenCounter.format(totalTokens)} (${messages.length} messages)`,
        200  // Allow longer detail for token info
      );
    }
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
      Logging.log("NewAgent", "Execution aborted by user", "info");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    Logging.log("NewAgent", `Execution error: ${errorMessage}`, "error");

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
      "NewAgent",
      `Execution complete: ${this.iterations} iterations, ${metrics.toolCalls} tool calls, ` +
        `${metrics.observations} observations, ${metrics.errors} errors, ` +
        `${successRate}% success rate, ${duration}ms duration`,
      "info",
    );

    // Log tool frequency if any tools were called
    if (metrics.toolCalls > 0) {
      Logging.log(
        "NewAgent",
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
    Logging.log("NewAgent", "Cleanup complete", "info");
  }

  /**
   * Handle glow animation for tools that interact with the browser
   * @param toolName - Name of the tool being executed
   */
  private async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    // Check if this tool should trigger glow animation
    if (!NewAgent.GLOW_ENABLED_TOOLS.has(toolName)) {
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

      // Get browser state with screenshot
      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision(),
        /* simplified */ true,
        /* screenshotSize */ "large"
      );

      // Get execution metrics for analysis
      const metrics = this.executionContext.getExecutionMetrics();
      const errorRate = metrics.toolCalls > 0
        ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
        : "0";
      const elapsed = Date.now() - metrics.startTime;

      // Check if we're in limited context mode
      const isLimitedContext = this.executionContext.isLimitedContextMode();

      // Get execution history only if NOT in limited context mode
      let fullHistory = "";
      if (!isLimitedContext) {
        const readOnlyMM = new MessageManagerReadOnly(this.executorMessageManager);
        fullHistory = readOnlyMM.getFilteredAsString([
          MessageType.SYSTEM,
          MessageType.SCREENSHOT,
          MessageType.BROWSER_STATE
        ]);
      }

      // Get reasoning history for context (always include as it's lightweight)
      const recentReasoning = this.executionContext.getReasoningHistory(5);

      // Get LLM with structured output
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      });
      const structuredLLM = llm.withStructuredOutput(PredefinedPlannerOutputSchema);

      // Predefined planner prompt
      const systemPrompt = generatePredefinedPlannerPrompt();

      // Build user prompt incrementally
      let userPrompt = `Current TODO List:\n${currentTodos}\n\n`;

      // Add execution metrics
      userPrompt += `EXECUTION METRICS:\n`;
      userPrompt += `- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)\n`;
      userPrompt += `- Observations taken: ${metrics.observations}\n`;
      userPrompt += `- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds\n`;

      // Add warning flags if needed
      if (parseInt(errorRate) > 30) {
        userPrompt += `⚠️ HIGH ERROR RATE - Current approach may be failing\n`;
      }
      if (metrics.toolCalls > 10 && metrics.errors > 5) {
        userPrompt += `⚠️ MANY ATTEMPTS - May be stuck in a loop\n`;
      }

      // Add full execution history if not in limited context
      if (!isLimitedContext && fullHistory) {
        userPrompt += `\nFULL EXECUTION HISTORY:\n`;
        userPrompt += `${fullHistory || "No execution yet"}\n\n`;
      }

      // Add reasoning history (always, as it's lightweight)
      if (recentReasoning.length > 0) {
        userPrompt += `YOUR PREVIOUS REASONING (what you thought would work):\n`;
        userPrompt += recentReasoning.map(r => {
          try {
            const parsed = JSON.parse(r);
            return `- ${parsed.reasoning || r}`;
          } catch {
            return `- ${r}`;
          }
        }).join("\n");
        userPrompt += "\n\n";
      }

      // Add task goal
      userPrompt += `Task Goal: ${task}\n\n`;

      // Add analysis instructions if we have history
      if (!isLimitedContext && fullHistory) {
        userPrompt += `ANALYZE the execution history above to understand:\n`;
        userPrompt += `1. What the executor actually attempted (check tool calls and results)\n`;
        userPrompt += `2. What failed and why (check error messages)\n`;
        userPrompt += `3. Whether your previous plan was executed correctly\n\n`;
      }

      // Add final instructions
      userPrompt += `Based on the `;
      if (!isLimitedContext) {
        userPrompt += `metrics, execution history, and `;
      }
      userPrompt += `current browser state:\n`;
      userPrompt += `1. Update the TODO list marking completed items with [x]\n`;
      userPrompt += `2. Identify the next uncompleted TODO to work on\n`;
      userPrompt += `3. Provide specific actions to complete that TODO\n`;
      userPrompt += `4. If all TODOs are complete, set allTodosComplete=true and provide a finalAnswer`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
        browserStateMessage,
      ];

      // Log token counts for individual messages and total
      this._logMessageTokens(messages, `Predefined Planner (iteration ${this.executionContext.getExecutionMetrics().observations})`);

      // Get structured response with retry
      const plan = await invokeWithRetry<PredefinedPlannerOutput>(
        structuredLLM,
        messages,
        3,
        { signal: this.executionContext.abortSignal }
      );

      // Store structured reasoning in context as JSON
      const plannerState = {
        todoMarkdown: plan.todoMarkdown,
        observation: plan.observation,
        reasoning: plan.reasoning,
        allTodosComplete: plan.allTodosComplete,
        actionsPlanned: plan.actions.length,
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
        "NewAgent",
        plan.allTodosComplete
          ? `Predefined Planner: All TODOs complete with final answer`
          : `Predefined Planner: ${plan.actions.length} actions planned for current TODO`,
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
   * Build execution context for predefined plans
   */
  private _buildPredefinedExecutionContext(
    plan: PredefinedPlannerOutput,
    actions: string[]
  ): string {
    const supportsVision = this.executionContext.supportsVision();

    const analysisSection = supportsVision
      ? `  <screenshot-analysis>
    The screenshot shows the webpage with nodeId numbers overlaid as visual labels on elements.
    These appear as numbers in boxes/labels (e.g., [21], [42], [156]) directly on the webpage elements.
    YOU MUST LOOK AT THE SCREENSHOT FIRST to identify which nodeId belongs to which element.
  </screenshot-analysis>`
      : `  <text-only-analysis>
    You are operating in TEXT-ONLY mode without screenshots.
    Use the browser state text to identify elements by their nodeId, text content, and attributes.
    Focus on element descriptions and hierarchical structure in the browser state.
  </text-only-analysis>`;

    const processSection = supportsVision
      ? `  <visual-execution-process>
    1. EXAMINE the screenshot - See the webpage with nodeId labels overlaid on elements
    2. LOCATE the element you need to interact with visually
    3. IDENTIFY its nodeId from the label shown on that element in the screenshot
    // 4. EXECUTE using that nodeId in your tool call
  </visual-execution-process>`
      : `  <text-execution-process>
    1. ANALYZE the browser state text to understand page structure
    2. LOCATE elements by their text content, type, and attributes
    3. IDENTIFY the correct nodeId from the browser state
    4. EXECUTE using that nodeId in your tool call
  </text-execution-process>`;

    const guidelines = supportsVision
      ? `    - The nodeIds are VISUALLY LABELED on the screenshot - you must look at it
    - The text-based browser state is supplementary - the screenshot is your primary reference
    - Batch multiple tool calls in one response when possible (reduces latency)
    - Call 'done' when the current actions are completed`
      : `    - Use the text-based browser state as your primary reference
    - Match elements by their text content and attributes
    - Batch multiple tool calls in one response when possible (reduces latency)
    - Call 'done' when the current actions are completed`;

    return `<predefined-plan-context>
  <observation>${plan.observation}</observation>
  <reasoning>${plan.reasoning}</reasoning>
</predefined-plan-context>

<execution-instructions>
${analysisSection}

  <actions-to-execute>
${actions.map((action, i) => `    ${i + 1}. ${action}`).join('\n')}
  </actions-to-execute>

${processSection}

  <execution-guidelines>
${guidelines}
  </execution-guidelines>
</execution-instructions>`;
  }

  /**
   * Build unified execution context combining planning and execution instructions
   */
  private _buildDynamicExecutionContext(
    plan: PlannerOutput,
    actions: string[]
  ): string {
    const supportsVision = this.executionContext.supportsVision();

    const analysisSection = supportsVision
      ? `  <screenshot-analysis>
    The screenshot shows the webpage with nodeId numbers overlaid as visual labels on elements.
    These appear as numbers in boxes/labels (e.g., [21], [42], [156]) directly on the webpage elements.
    YOU MUST LOOK AT THE SCREENSHOT FIRST to identify which nodeId belongs to which element.
  </screenshot-analysis>`
      : `  <text-only-analysis>
    You are operating in TEXT-ONLY mode without screenshots.
    Use the browser state text to identify elements by their nodeId, text content, and attributes.
    Focus on element descriptions and hierarchical structure in the browser state.
  </text-only-analysis>`;

    const processSection = supportsVision
      ? `  <visual-execution-process>
    1. EXAMINE the screenshot - See the webpage with nodeId labels overlaid on elements
    2. LOCATE the element you need to interact with visually
    3. IDENTIFY its nodeId from the label shown on that element in the screenshot
    4. EXECUTE using that nodeId in your tool call
  </visual-execution-process>`
      : `  <text-execution-process>
    1. ANALYZE the browser state text to understand page structure
    2. LOCATE elements by their text content, type, and attributes
    3. IDENTIFY the correct nodeId from the browser state
    4. EXECUTE using that nodeId in your tool call
  </text-execution-process>`;

    const guidelines = supportsVision
      ? `    - The nodeIds are VISUALLY LABELED on the screenshot - you must look at it
    - The text-based browser state is supplementary - the screenshot is your primary reference
    - Batch multiple tool calls in one response when possible (reduces latency)
    - Create a todo list to track progress if helpful
    - Call 'done' when all actions are completed`
      : `    - Use the text-based browser state as your primary reference
    - Match elements by their text content and attributes
    - Batch multiple tool calls in one response when possible (reduces latency)
    - Create a todo list to track progress if helpful
    - Call 'done' when all actions are completed`;

    return `<planning-context>
  <observation>${plan.observation}</observation>
  <challenges>${plan.challenges}</challenges>
  <reasoning>${plan.reasoning}</reasoning>
</planning-context>

<execution-instructions>
${analysisSection}

  <actions-to-execute>
${actions.map((action, i) => `    ${i + 1}. ${action}`).join('\n')}
  </actions-to-execute>

${processSection}

  <execution-guidelines>
${guidelines}
  </execution-guidelines>
</execution-instructions>`;
  }
}
