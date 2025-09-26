import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager, MessageType } from "@/lib/runtime/MessageManager";
import { ToolManager } from "@/lib/tools/ToolManager";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { type ScreenshotSizeKey } from "@/lib/browser/BrowserOSAdapter";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { getLLM } from "@/lib/llm/LangChainProvider";
import { PubSub } from "@/lib/pubsub";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { HumanInputResponse, PubSubEvent } from "@/lib/pubsub/types";
import { Logging } from "@/lib/utils/Logging";
import { AbortError } from "@/lib/utils/Abortable";
import { jsonParseToolOutput } from "@/lib/utils/utils";
import { isDevelopmentMode } from "@/config";
import {
  generateDynamicUnifiedPrompt,
  generatePredefinedUnifiedPrompt,
  getToolDescriptions
} from "./LocalAgent.prompt";
import {
  createClickTool,
  createTypeTool,
  createClearTool,
  createScrollTool,
  createNavigateTool,
  createKeyTool,
  createWaitTool,
  createTabsTool,
  createTabOpenTool,
  createTabFocusTool,
  createTabCloseTool,
  createExtractTool,
  createHumanInputTool,
  createDoneTool,
  createMoondreamVisualClickTool,
  createMoondreamVisualTypeTool,
  createGrepElementsTool,
  createCelebrationTool,
} from "@/lib/tools/NewTools";
import { createGroupTabsTool } from "@/lib/tools/tab/GroupTabsTool";
import { createBrowserOSInfoTool } from '@/lib/tools/utility/BrowserOSInfoTool';
import { createGetSelectedTabsTool } from "@/lib/tools/tab/GetSelectedTabsTool";
import { createDateTool } from "@/lib/tools/utility/DateTool";
import { createMCPTool } from "@/lib/tools/mcp/MCPTool";
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';
import { TokenCounter } from "../utils/TokenCounter";
import { wrapToolForMetrics } from '@/evals2/EvalToolWrapper';
import { ENABLE_EVALS2 } from '@/config';
import { invokeWithRetry } from "@/lib/utils/retryable";
import { SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// Constants for unified agent
const MAX_UNIFIED_ITERATIONS = 30;  // Reduced for unified mode
const MAX_RETRIES = 3;  // For LLM retries

// Human input constants
const HUMAN_INPUT_TIMEOUT = 600000;  // 10 minutes
const HUMAN_INPUT_CHECK_INTERVAL = 500;  // Check every 500ms

// Simple execution entry for tracking history - one entry per tool call OR a summary
interface SimpleExecutionEntry {
  iteration: number;
  tool?: string;
  args?: any;
  result?: string;
  summary?: string; // For summarized entries
  timestamp: number;
}

// Simplified result interfaces for unified agent
interface UnifiedResult {
  doneToolCalled: boolean;
  requiresHumanInput: boolean;
}

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
  private unifiedLlmWithTools: Runnable<
    BaseLanguageModelInput,
    AIMessageChunk
  > | null = null; // Pre-bound LLM with tools

  // Execution state
  private iterations: number = 0;
  private consecutiveNoToolCalls: number = 0;

  // Simplified execution history - one entry per tool call
  private executionHistory: SimpleExecutionEntry[] = [];
  private toolDescriptions = getToolDescriptions();

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.toolManager = new ToolManager(executionContext);
    this.glowService = GlowAnimationService.getInstance();
    Logging.log("LocalAgent", "Agent instance created", "info");
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
    this.unifiedLlmWithTools = llm.bindTools(this.toolManager.getAll());

    // Reset state
    this.iterations = 0;
    this.consecutiveNoToolCalls = 0;
    this.executionHistory = [];

    Logging.log(
      "LocalAgent",
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
    this.toolManager.register(createExtractTool(this.executionContext)); // Extract text from page
    this.toolManager.register(createHumanInputTool(this.executionContext));
    this.toolManager.register(createCelebrationTool(this.executionContext)); // Celebration/confetti tool
    this.toolManager.register(createDateTool(this.executionContext)); // Date/time utilities
    this.toolManager.register(createBrowserOSInfoTool(this.executionContext)); // BrowserOS info tool
    
    // External integration tools
    this.toolManager.register(createMCPTool(this.executionContext)); // MCP server integration

    // ALWAYS register grep_elements for LocalAgent (always operates in limited context mode)
    this.toolManager.register(createGrepElementsTool(this.executionContext)); // Search elements mandatory for small agent

    // Completion tool
    this.toolManager.register(createDoneTool(this.executionContext));

    Logging.log(
      "LocalAgent",
      `Registered ${this.toolManager.getAll().length} tools`,
      "info",
    );
  }


  // Dual mode: Support both dynamic and predefined execution
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

      Logging.log("LocalAgent", `Starting unified execution`, "info");
      await this._initialize();

      // Check for predefined vs dynamic execution mode
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
        const activeGlows = this.glowService.getAllActiveGlows();
        for (const tabId of activeGlows) {
          this.glowService.stopGlow(tabId);
        }
      } catch (error) {
        console.error(`Could not stop glow animation: ${error}`);
      }
    }
  }

  /**
   * Execute dynamic (non-predefined) tasks
   */
  private async _executeDynamic(task: string): Promise<void> {
    this.executionContext.setCurrentTask(task);

    // Validate LLM is initialized with tools bound
    if (!this.unifiedLlmWithTools) {
      throw new Error("LLM with tools not initialized");
    }

    let done = false;

    // Publish start message
    this._publishMessage("Starting unified task execution...", "thinking");

    while (!done && this.iterations < MAX_UNIFIED_ITERATIONS) {
      this.checkIfAborted();
      this.iterations++;

      Logging.log(
        "LocalAgent",
        `Unified iteration ${this.iterations}/${MAX_UNIFIED_ITERATIONS}`,
        "info",
      );

      // Run dynamic agent - single call that thinks and acts
      const result = await this._runDynamicAgent(task);

      // Handle human input if needed
      if (result.requiresHumanInput) {
        const humanResponse = await this._waitForHumanInput();

        if (humanResponse === 'abort') {
          this._publishMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }

        this._publishMessage('✅ Human completed manual action. Continuing...', 'thinking');
        this.executionContext.clearHumanInputState();
      }

      if (result.doneToolCalled) {
        done = true;
        this._publishMessage("Task completed successfully", "assistant");
        break;
      }
    }

    // Check if we hit iteration limit
    if (!done && this.iterations >= MAX_UNIFIED_ITERATIONS) {
      this._publishMessage(
        `Task did not complete within ${MAX_UNIFIED_ITERATIONS} iterations`,
        "error",
      );
      throw new Error(
        `Maximum unified iterations (${MAX_UNIFIED_ITERATIONS}) reached`,
      );
    }

    Logging.log("LocalAgent", `Dynamic execution complete`, "info");
  }

  /**
   * Execute predefined tasks with known steps
   */
  private async _executePredefined(task: string, predefinedPlan: any): Promise<void> {
    this.executionContext.setCurrentTask(task);

    // Validate LLM is initialized with tools bound
    if (!this.unifiedLlmWithTools) {
      throw new Error("LLM with tools not initialized");
    }

    let done = false;

    // Publish start message
    this._publishMessage(`Starting predefined task: ${predefinedPlan.name}`, "thinking");

    while (!done && this.iterations < MAX_UNIFIED_ITERATIONS) {
      this.checkIfAborted();
      this.iterations++;

      Logging.log(
        "LocalAgent",
        `Predefined iteration ${this.iterations}/${MAX_UNIFIED_ITERATIONS}`,
        "info",
      );

      // Run predefined agent - single call that executes steps
      const result = await this._runPredefinedAgent(task, predefinedPlan);

      if (result.doneToolCalled) {
        done = true;
        this._publishMessage("Predefined task completed successfully", "assistant");
        break;
      }

      // Handle human input if needed
      if (result.requiresHumanInput) {
        const humanResponse = await this._waitForHumanInput();

        if (humanResponse === 'abort') {
          this._publishMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }

        this._publishMessage('✅ Human completed manual action. Continuing...', 'thinking');
        this.executionContext.clearHumanInputState();
      }
    }

    // Check if we hit iteration limit
    if (!done && this.iterations >= MAX_UNIFIED_ITERATIONS) {
      this._publishMessage(
        `Predefined task did not complete within ${MAX_UNIFIED_ITERATIONS} iterations`,
        "error",
      );
      throw new Error(
        `Maximum unified iterations (${MAX_UNIFIED_ITERATIONS}) reached`,
      );
    }

    Logging.log("LocalAgent", `Predefined execution complete`, "info");
  }

  /**
   * Run the dynamic agent for non-predefined tasks
   */
  private async _runDynamicAgent(task: string): Promise<UnifiedResult> {
    try {
      this.executionContext.incrementMetric("observations");;

      // Get system prompt with tool descriptions for dynamic tasks
      const systemPrompt = generateDynamicUnifiedPrompt(this.toolDescriptions || "");
      const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt));

      // Build execution history context
      const executionHistoryContext = await this._buildExecutionHistoryContext(
        (this.executionContext.getMaxTokens() - systemPromptTokens)*0.7,
        task
      );

      // Build user prompt with task and history
      const userPrompt = this._buildUserPrompt(task, executionHistoryContext);
      const userPromptTokens = TokenCounter.countMessage(new HumanMessage(userPrompt));

      // Get browser state message (always limited context mode)
      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
        /* simplified */ true,
        /* screenshotSize */ "medium",
        /* includeBrowserState */ true,
        /* browserStateTokensLimit */ (this.executionContext.getMaxTokens() - systemPromptTokens - userPromptTokens)*0.7
      );

      const mm = new MessageManager();
      mm.add(new SystemMessage(systemPrompt));
      mm.add(browserStateMessage);
      mm.add(new HumanMessage(userPrompt));

      // Get LLM response with tool calls
      const llmResponse = await this._invokeLLMWithStreaming(mm);

      // Process tool calls if any
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        this.consecutiveNoToolCalls = 0; // Reset counter
        const result = await this._processToolCalls(llmResponse.tool_calls);

        return {
          doneToolCalled: result.doneToolCalled,
          requiresHumanInput: result.requiresHumanInput,
        };
      }

      // No tool calls - increment counter
      this.consecutiveNoToolCalls++;
      if (this.consecutiveNoToolCalls >= MAX_RETRIES) {
        throw new Error(`Executor failed for ${MAX_RETRIES} retries - no tool calls generated`);
      }

      return {
        doneToolCalled: false,
        requiresHumanInput: false,
      };

    } catch (error) {
      this.executionContext.incrementMetric("errors");
      Logging.log("LocalAgent", `Dynamic agent error: ${error}`, "error");
      return {
        doneToolCalled: false,
        requiresHumanInput: false,
      };
    }
  }

  /**
   * Run the predefined agent for tasks with known steps
   */
  private async _runPredefinedAgent(task: string, predefinedPlan: any): Promise<UnifiedResult> {
    try {
      this.executionContext.incrementMetric("observations");

      // Get system prompt with tool descriptions for predefined tasks
      const systemPrompt = generatePredefinedUnifiedPrompt(this.toolDescriptions || "");
      const systemPromptTokens = TokenCounter.countMessage(new SystemMessage(systemPrompt));

      // Build execution history context
      const executionHistoryContext = await this._buildExecutionHistoryContext(
        (this.executionContext.getMaxTokens() - systemPromptTokens)*0.7,
        task
      );

      // Build user prompt with task, plan, and history
      const userPrompt = this._buildPredefinedUserPrompt(task, predefinedPlan, executionHistoryContext);
      const userPromptTokens = TokenCounter.countMessage(new HumanMessage(userPrompt));

      // Get browser state message (always limited context mode)
      const browserStateMessage = await this._getBrowserStateMessage(
        /* includeScreenshot */ this.executionContext.supportsVision() && !this.executionContext.isLimitedContextMode(),
        /* simplified */ true,
        /* screenshotSize */ "medium",
        /* includeBrowserState */ true,
        /* browserStateTokensLimit */ (this.executionContext.getMaxTokens() - systemPromptTokens - userPromptTokens)*0.7
      );

      const mm = new MessageManager();
      mm.add(new SystemMessage(systemPrompt));
      mm.add(browserStateMessage);
      mm.add(new HumanMessage(userPrompt));

      // Get LLM response with tool calls
      const llmResponse = await this._invokeLLMWithStreaming(mm);

      // Process tool calls if any
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        this.consecutiveNoToolCalls = 0; // Reset counter
        const result = await this._processToolCalls(llmResponse.tool_calls);

        return {
          doneToolCalled: result.doneToolCalled,
          requiresHumanInput: result.requiresHumanInput,
        };
      }

      // No tool calls - increment counter
      this.consecutiveNoToolCalls++;
      if (this.consecutiveNoToolCalls >= MAX_RETRIES) {
        throw new Error(`Executor failed for ${MAX_RETRIES} retries - no tool calls generated`);
      }

      return {
        doneToolCalled: false,
        requiresHumanInput: false,
      };

    } catch (error) {
      this.executionContext.incrementMetric("errors");
      Logging.log("LocalAgent", `Predefined agent error: ${error}`, "error");
      return {
        doneToolCalled: false,
        requiresHumanInput: false,
      };
    }
  }

  /**
   * Build execution history context for the unified prompt
   */
  private async _buildExecutionHistoryContext(tokenLimit: number, userTask: string): Promise<string> {
    if (this.executionHistory.length === 0) {
      return "No previous actions attempted";
    }

    // Build full execution history first
    const fullHistory = this.executionHistory.map((entry) => {
      if (entry.summary) {
        // This is a summarized entry
        return `=== ITERATIONS 1-${entry.iteration} SUMMARY ===\n${entry.summary}`;
      } else {
        // This is a regular tool call entry
        return `Iteration ${entry.iteration}: Tool Call: ${entry.tool}(${JSON.stringify(entry.args)}) Tool Result: ${entry.result}`;
      }
    }).join('\n\n');

    // Check token count of full history
    const fullHistoryTokens = TokenCounter.countMessage(new HumanMessage(fullHistory));

    // If full history exceeds 70% of max tokens, summarize it
    if (fullHistoryTokens > tokenLimit) {
      try {
        const summary = await this._summarizeExecutionHistory(fullHistory, userTask, tokenLimit);

        // Clear the execution history after summarizing and add summarized state to the history
        this.executionHistory = [];
        this.executionHistory.push({
          iteration: this.iterations - 1, // Summary is for previous iterations
          summary: summary,
          timestamp: Date.now(),
        });

        return summary;
      } catch (error) {
        Logging.log("LocalAgent", `Failed to summarize execution history: ${error}`, "warning");
        // Fallback to last 5 iterations if summarization fails
        const recentEntries = this.executionHistory.slice(-5);
        return recentEntries.map((entry) => {
          if (entry.summary) {
            return `=== ITERATIONS 1-${entry.iteration} SUMMARY ===\n${entry.summary}`;
          } else {
            return `Iteration ${entry.iteration}: Tool Call: ${entry.tool}(${JSON.stringify(entry.args)}) Tool Result: ${entry.result}`;
          }
        }).join('\n\n');
      }
    }

    return fullHistory;
  }

  /**
   * Summarize execution history when it gets too long
   */
  private async _summarizeExecutionHistory(history: string, userTask: string, tokenLimit: number): Promise<string> {
    // if token limit is less than 100, set it to 100
    if (tokenLimit < 100) {
      tokenLimit = 100;
    }
    tokenLimit = Math.floor(tokenLimit);

    // Get LLM for plain text output (better for small models)
    const llm = await getLLM({
      temperature: 0.2,
      maxTokens: tokenLimit,
    });

    const systemPrompt = `You are an expert summarizer. Your job is to review the execution history of a task and concisely summarize what actions have been attempted, what succeeded, and what failed.

Your summary should condense the entire execution history, clearly outlining:
- What the user wanted to accomplish
- What steps were taken in each iteration
- Which actions succeeded and which failed (with reasons if available)
- Any patterns, repeated errors, or important observations

Output only the summary of the execution history with less than ${tokenLimit} tokens. Output only the summary, no other text.`;

    const userPrompt = `User Task: ${userTask}

Execution History:
${history}

Please provide a concise summary with less than ${tokenLimit} tokens of what has been attempted so far:`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    const result = await invokeWithRetry(llm, messages, MAX_RETRIES, { signal: this.executionContext.abortSignal });
    return (result as any)?.content as string || "";
  }

  /**
   * Build user prompt for unified agent
   */
  private _buildUserPrompt(task: string, executionHistory: string): string {
    const metrics = this.executionContext.getExecutionMetrics();
    const errorRate = metrics.toolCalls > 0
      ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
      : "0";

    return `TASK: ${task}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Iterations: ${this.iterations}

${parseInt(errorRate) > 30 && metrics.errors > 3  ? "⚠️ HIGH ERROR RATE - Learn from the past execution history and adapt your approach" : ""}

EXECUTION HISTORY:
${executionHistory}`;
  }

  private _buildPredefinedUserPrompt(task: string, predefinedPlan: any, executionHistory: string): string {
    const metrics = this.executionContext.getExecutionMetrics();
    const errorRate = metrics.toolCalls > 0
      ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
      : "0";

    return `TASK: ${task}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Iterations: ${this.iterations}

${parseInt(errorRate) > 30 && metrics.errors > 3 ? "⚠️ HIGH ERROR RATE - Learn from the past execution history and adapt your approach" : ""}

PREDEFINED PLAN:
- Agent: ${predefinedPlan.name}
- Goal: ${predefinedPlan.goal}
- Steps: ${predefinedPlan.steps.map((step: string, index: number) => `${index + 1}. ${step}`).join('\n  ')}

EXECUTION HISTORY:
${executionHistory}`;
  }

  /**
   * Detect special predefined tasks that have specific metadata
   */
  private _getSpecialTaskMetadata(task: string): {task: string, metadata: ExecutionMetadata} | null {
    // Case-insensitive comparison
    const taskLower = task.toLowerCase();

    // BrowserOS Launch Upvote Task
    if (taskLower === "visit browseros launch and upvote ❤️") {
      return {
        task: "Visit BrowserOS launch and upvote",
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
    if (taskLower === "go to github and star browseros ⭐") {
      return {
        task: "Star the BrowserOS GitHub repository",
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


  private async _invokeLLMWithStreaming(messageManager: MessageManager): Promise<AIMessage> {
    // Use the pre-bound unified LLM (created and bound once during initialization)
    if (!this.unifiedLlmWithTools) {
      throw new Error("Unified LLM not initialized - ensure _initialize() was called");
    }

    // Tags that should never be output to users
    const PROHIBITED_TAGS = [
      '<browser-state>',
      '<system-reminder>',
      '</browser-state>',
      '</system-reminder>'
    ];

    const message_history = messageManager.getMessages();

    const stream = await this.unifiedLlmWithTools.stream(message_history, {
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
            messageManager.queueSystemReminder(
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
    toolCalls: any[]
  ): Promise<UnifiedResult> {
    const result: UnifiedResult = {
      doneToolCalled: false,
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

      // Add to execution history immediately with actual result
      this.executionHistory.push({
        iteration: this.iterations,
        tool: toolName,
        args: args,
        result: toolResult,
        timestamp: Date.now(),
      });

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

    Logging.logMetric("localagent.execution", {
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
    this.consecutiveNoToolCalls = 0;
    this.executionHistory = [];
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






}

