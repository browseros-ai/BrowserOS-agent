/**
 * NewAgent - Experimental browser automation agent with minimal tool set
 * Migrated to use BrowserAgent's proven patterns for LLM interaction
 */

import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager, MessageManagerReadOnly, MessageType } from "@/lib/runtime/MessageManager";
import { ToolManager } from "@/lib/tools/ToolManager";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
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

// Constants
const MAX_PLANNER_ITERATIONS = 50;
const MAX_EXECUTOR_ITERATIONS = 3;

// Human input constants
const HUMAN_INPUT_TIMEOUT = 600000;  // 10 minutes
const HUMAN_INPUT_CHECK_INTERVAL = 500;  // Check every 500ms

// Planner output schema
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

export class NewAgent {
  // Core dependencies
  private readonly executionContext: ExecutionContext;
  private readonly toolManager: ToolManager;
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
    Logging.log("NewAgent", "Agent instance created", "info");
  }

  private get messageManager(): MessageManager {
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
    this.toolManager.register(createTodoSetTool(this.executionContext));
    this.toolManager.register(createTodoGetTool(this.executionContext));

    // Tab management tools
    this.toolManager.register(createTabsTool(this.executionContext));
    this.toolManager.register(createTabOpenTool(this.executionContext));
    this.toolManager.register(createTabFocusTool(this.executionContext));
    this.toolManager.register(createTabCloseTool(this.executionContext));

    // Utility tools
    this.toolManager.register(createExtractTool(this.executionContext));
    this.toolManager.register(createHumanInputTool(this.executionContext));

    // Completion tool
    this.toolManager.register(createDoneTool(this.executionContext));

    Logging.log(
      "NewAgent",
      `Registered ${this.toolManager.getAll().length} tools`,
      "info",
    );
  }

  async execute(task: string, _metadata?: any): Promise<void> {
    try {
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      });

      Logging.log("NewAgent", `Starting execution`, "info");
      await this._initialize();
      await this._run(task);
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
    }
  }

  private async _run(task: string): Promise<void> {
    // Set current task in context
    this.executionContext.setCurrentTask(task);

    // executor system prompt
    const systemPrompt = generateExecutorPrompt();
    this.messageManager.addSystem(systemPrompt);

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
      const planResult = await this._runPlanner(task);
      // CRITICAL: Flush any queued messages from planning
      this.messageManager.flushQueue();

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

      // Build unified execution context with planning + execution instructions
      const executionContext = this._buildExecutionContext(plan, plan.actions);
      this.messageManager.addSystemReminder(executionContext);

      const executionResult = await this._runExecutor(plan.actions);

      // Check execution outcomes
      if (executionResult.requiresHumanInput) {
        // Human input requested - wait for response
        const humanResponse = await this._waitForHumanInput();
        
        if (humanResponse === 'abort') {
          // Human aborted the task
          this._publishMessage('❌ Task aborted by human', 'assistant');
          throw new AbortError('Task aborted by human');
        }
        
        // Human clicked "Done" - continue with next planning iteration
        this._publishMessage('✅ Human completed manual action. Re-planning...', 'thinking');
        this.messageManager.addAI('Human has completed the requested manual action. Continuing with the task.');
        
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

  private async getStateMessage(
    includeScreenshot: boolean,
    simplified: boolean = true,
  ): Promise<HumanMessage> {
    // Get browser state string
    const browserStateString =
      await this.executionContext.browserContext.getBrowserStateString(
        simplified,
      );

    if (includeScreenshot) {
      // Get current page and take screenshot
      const page = await this.executionContext.browserContext.getCurrentPage();
      const screenshot = await page.takeScreenshot("large", true);

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

  private async _runPlanner(task: string): Promise<PlannerResult> {
    try {
      this.executionContext.incrementMetric("observations");

      // Get browser state message with screenshot
      const browserStateMessage = await this.getStateMessage(true, true);

      // Get execution metrics for analysis
      const metrics = this.executionContext.getExecutionMetrics();
      const errorRate = metrics.toolCalls > 0 
        ? ((metrics.errors / metrics.toolCalls) * 100).toFixed(1)
        : "0";
      const elapsed = Date.now() - metrics.startTime;

      // Get messagey history
      const readOnlyMM = new MessageManagerReadOnly(this.messageManager);
      const fullHistory = readOnlyMM.getFilteredAsString([MessageType.SYSTEM, MessageType.SCREENSHOT, MessageType.BROWSER_STATE]);

      // Get reasoning history for context
      const recentReasoning = this.executionContext.getReasoningHistory(5);

      // Get LLM with structured output
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 4096,
      });
      const structuredLLM = llm.withStructuredOutput(PlannerOutputSchema);

      // System prompt for planner
      const systemPrompt = generatePlannerPrompt();

      const userPrompt = `TASK: ${task}

EXECUTION METRICS:
- Tool calls: ${metrics.toolCalls} (${metrics.errors} errors, ${errorRate}% failure rate)
- Observations taken: ${metrics.observations}
- Time elapsed: ${(elapsed / 1000).toFixed(1)} seconds
${parseInt(errorRate) > 30 ? "⚠️ HIGH ERROR RATE - Current approach may be failing" : ""}
${metrics.toolCalls > 10 && metrics.errors > 5 ? "⚠️ MANY ATTEMPTS - May be stuck in a loop" : ""}

FULL EXECUTION HISTORY:
${fullHistory || "No execution history yet"}

${
  recentReasoning.length > 0
    ? `YOUR PREVIOUS REASONING (what you thought would work):
${recentReasoning.map(r => {
  try {
    const parsed = JSON.parse(r);
    return `- ${parsed.reasoning || r}`;
  } catch {
    return `- ${r}`;
  }
}).join("\n")}

`
    : ""
}ANALYZE the execution history above to understand:
1. What the executor actually attempted (check tool calls and results)
2. What failed and why (check error messages)
3. Whether your previous plan was executed correctly

Based on the metrics, execution history, and current browser state, what should we do next?`;

      // Build messages
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
        browserStateMessage, // Browser state with screenshot
      ];

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
        // Add current browser state with screenshot
        const browserStateMessage = await this.getStateMessage(false, true);
        // remove old state and screenshot messages first
        this.messageManager.removeMessagesByType(MessageType.BROWSER_STATE);
        this.messageManager.removeMessagesByType(MessageType.SCREENSHOT);
        // add new state
        this.messageManager.add(browserStateMessage);

        // Simple prompt - all context is already in system reminder
        this.messageManager.addHuman(
          "Please execute the actions specified in the system reminder above."
        );
        isFirstPass = false;
      } else {
        this.messageManager.addHuman(
          "Please continue or call 'done' tool if all actions are completed.",
        );
      }

      // Get LLM response with tool calls
      const llmResponse = await this._invokeLLMWithStreaming();

      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        // Process tool calls
        this.messageManager.add(llmResponse);
        const toolsResult = await this._processToolCalls(
          llmResponse.tool_calls,
        );

        // Update iteration count and metrics
        this.iterations += llmResponse.tool_calls.length;
        for (let i = 0; i < llmResponse.tool_calls.length; i++) {
          this.executionContext.incrementMetric("toolCalls");
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
        this.messageManager.addAI(llmResponse.content as string);
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

    const message_history = this.messageManager.getMessages();

    const stream = await this.executorLlmWithTools.stream(message_history, {
      signal: this.executionContext.abortSignal,
    });

    let accumulatedChunk: AIMessageChunk | undefined;
    let accumulatedText = "";
    let hasStartedThinking = false;
    let currentMsgId: string | null = null;

    for await (const chunk of stream) {
      this.checkIfAborted(); // Manual check during streaming

      if (chunk.content && typeof chunk.content === "string") {
        // Start thinking on first real content
        if (!hasStartedThinking) {
          hasStartedThinking = true;
          // Create message ID on first content chunk
          currentMsgId = PubSub.generateId("msg_assistant");
        }

        // Stream thought chunk
        accumulatedText += chunk.content;

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
      accumulatedChunk = !accumulatedChunk
        ? chunk
        : accumulatedChunk.concat(chunk);
    }

    // Only finish thinking if we started and have content
    if (hasStartedThinking && accumulatedText.trim() && currentMsgId) {
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
      
      this.messageManager.addTool(toolResult, toolCallId);

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
    this.messageManager.flushQueue();

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

    Logging.log(
      "NewAgent",
      `Execution complete: ${this.iterations} iterations, ${metrics.toolCalls} tool calls, ` +
        `${metrics.observations} observations, ${metrics.errors} errors, ` +
        `${successRate}% success rate, ${duration}ms duration`,
      "info",
    );

    Logging.logMetric("newagent.execution", {
      iterations: this.iterations,
      toolCalls: metrics.toolCalls,
      observations: metrics.observations,
      errors: metrics.errors,
      duration,
      successRate: parseFloat(successRate),
    });
  }

  private _cleanup(): void {
    this.iterations = 0;
    Logging.log("NewAgent", "Cleanup complete", "info");
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
   * Build unified execution context combining planning and execution instructions
   */
  private _buildExecutionContext(
    plan: PlannerOutput,
    actions: string[]
  ): string {
    return `<planning-context>
  <observation>${plan.observation}</observation>
  <challenges>${plan.challenges}</challenges>
  <reasoning>${plan.reasoning}</reasoning>
</planning-context>

<execution-instructions>
  <screenshot-analysis>
    The screenshot shows the webpage with nodeId numbers overlaid as visual labels on elements.
    These appear as numbers in boxes/labels (e.g., [21], [42], [156]) directly on the webpage elements.
    YOU MUST LOOK AT THE SCREENSHOT FIRST to identify which nodeId belongs to which element.
  </screenshot-analysis>
  
  <actions-to-execute>
${actions.map((action, i) => `    ${i + 1}. ${action}`).join('\n')}
  </actions-to-execute>
  
  <visual-execution-process>
    1. EXAMINE the screenshot - See the webpage with nodeId labels overlaid on elements
    2. LOCATE the element you need to interact with visually
    3. IDENTIFY its nodeId from the label shown on that element in the screenshot
    4. EXECUTE using that nodeId in your tool call
  </visual-execution-process>
  
  <execution-guidelines>
    - The nodeIds are VISUALLY LABELED on the screenshot - you must look at it
    - The text-based browser state is supplementary - the screenshot is your primary reference
    - Batch multiple tool calls in one response when possible (reduces latency)
    - Create a todo list to track progress if helpful
    - Call 'done' when all actions are completed
  </execution-guidelines>
</execution-instructions>`;
  }
}
