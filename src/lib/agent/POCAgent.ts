import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { ToolManager } from "@/lib/tools/ToolManager";
import { ExecutionMetadata, MessageType } from "@/lib/types/messaging";
import {
  createDoneTool,
  createObserveTool,
  createContinueTool,
  createReplanTool,
} from "@/lib/tools/utils/DoneTool";
import { createNavigationTool } from "@/lib/tools/navigation/NavigationTool";
import { createInteractionTool } from "@/lib/tools/navigation/InteractionTool";
import { createScrollTool } from "@/lib/tools/navigation/ScrollTool";
import { createSearchTool } from "@/lib/tools/navigation/SearchTool";
import { createRefreshStateTool } from "@/lib/tools/navigation/RefreshStateTool";
import { createTabOperationsTool } from "@/lib/tools/tab/TabOperationsTool";
import { createScreenshotTool } from "@/lib/tools/utils/ScreenshotTool";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { AbortError } from "@/lib/utils/Abortable";
import { GlowAnimationService } from "@/lib/services/GlowAnimationService";
import { PubSub } from "@/lib/pubsub"; // For static helper methods
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { Logging } from "@/lib/utils/Logging";
import { jsonParseToolOutput } from "@/lib/utils/utils";
import { createPlannerTool } from "@/lib/tools/planning/PlannerTool";
import { createTodoManagerTool } from "@/lib/tools/planning/TodoManagerTool";
import { createRequirePlanningTool } from "@/lib/tools/planning/RequirePlanningTool";
import { createGroupTabsTool } from "@/lib/tools/tab/GroupTabsTool";
import { createGetSelectedTabsTool } from "@/lib/tools/tab/GetSelectedTabsTool";
import { createClassificationTool } from "@/lib/tools/classification/ClassificationTool";
import { createValidatorTool } from "@/lib/tools/validation/ValidatorTool";
import { createStorageTool } from "@/lib/tools/utils/StorageTool";
import { createExtractTool } from "@/lib/tools/extraction/ExtractTool";
import { createResultTool } from "@/lib/tools/result/ResultTool";
import { createHumanInputTool } from "@/lib/tools/utils/HumanInputTool";
import { createDateTool } from "@/lib/tools/utility/DateTool";
import { createMCPTool } from "@/lib/tools/mcp/MCPTool";
import { LLMMessageType } from "@/lib/runtime/MessageManager";
import {
  generateSystemPrompt,
  generateObserveDecidePrompt,
  generateSingleTurnExecutionPrompt,
} from "./POCAgent.prompt";

interface SingleTurnResult {
  doneToolCalled: boolean;
  observeToolCalled?: boolean;
  continueToolCalled?: boolean;
  replanToolCalled?: boolean;
  success?: boolean;
}

interface ObserveDecideResult {
  doneToolCalled?: boolean;
  replanToolCalled?: boolean;
}

interface Plan {
  todoMarkdown: string; // Markdown TODO list format (- [ ] format)
}

interface CapturedState {
  screenshot?: string;
  domState?: string;
  title?: string;
  currentUrl?: string;
  timestamp: number;
  tabId?: number;
}

export class POCAgent {
  private static readonly PLANNING_INTERVAL = 5;
  private static readonly MAX_ITERATIONS = 50;

  private static readonly GLOW_ENABLED_TOOLS = new Set([
    "navigation_tool",
    "interact_tool",
    "scroll_tool",
    "search_tool",
    "refresh_browser_state_tool",
    "tab_operations_tool",
    "screenshot_tool",
    "extract_tool",
  ]);

  private readonly executionContext: ExecutionContext;
  private readonly toolManager: ToolManager;
  private readonly glowService: GlowAnimationService;
  private stepCounter: number = 0;

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.toolManager = new ToolManager(executionContext);
    this.glowService = GlowAnimationService.getInstance();

    this._registerTools();
  }

  private get messageManager(): MessageManager {
    return this.executionContext.messageManager;
  }

  private get pubsub(): PubSubChannel {
    return this.executionContext.getPubSub();
  }

  public get currentStepCount(): number {
    return this.stepCounter;
  }

  private checkIfAborted(): void {
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError();
    }
  }

  public cleanup(): void {}

  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    try {
      // Reset step counter for new execution
      this.stepCounter = 0;

      this._initializeExecution(task);
      this.pubsub.publishMessage(
        PubSub.createMessage("Starting BrowserOS execution...", "thinking"),
      );
      let currentPlan: string | null = null;
      let taskComplete = false;
      let needsReplan = false;

      while (!taskComplete && this.stepCounter < POCAgent.MAX_ITERATIONS) {
        this.checkIfAborted();

        // Plan if needed (initial, periodic, or requested)
        if (this._shouldPlan(this.stepCounter, needsReplan, currentPlan)) {
          Logging.log(
            "POCAgent",
            `Planning next steps. Step counter: ${this.stepCounter}`,
            "info",
          );
          currentPlan = await this._planningInterface(task, currentPlan);
          needsReplan = false;
        }

        // Decide on actions (state capture happens inside _observeDecide)
        const decision = await this._observeDecide(currentPlan, task);
        Logging.log(
          "POCAgent",
          `ObserveDecide result: ${JSON.stringify(decision)}`,
          "info",
        );

        // Handle control flow decisions
        if (decision.doneToolCalled) {
          // Validate task completion before marking as complete
          const validationResult = await this._validateTaskCompletion(task);

          if (validationResult.isComplete) {
            taskComplete = true;
            Logging.log(
              "POCAgent",
              `Task validated as complete: ${validationResult.reasoning}`,
              "info",
            );
          } else {
            // Task not actually complete - continue execution
            Logging.log(
              "POCAgent",
              `Task validation failed: ${validationResult.reasoning}`,
              "info",
            );

            // Add validation feedback to message history for next iteration
            if (validationResult.suggestions.length > 0) {
              const validationMessage = `Task not complete still\nReasoning: ${validationResult.reasoning}\nSuggestions: ${validationResult.suggestions.join(", ")}`;
              this.messageManager.addHuman(validationMessage);
            }

            needsReplan = true; // Trigger replanning with validation feedback
          }
        } else if (decision.replanToolCalled) {
          needsReplan = true;
        }
        this.stepCounter++;
      }

      if (!taskComplete && this.stepCounter >= POCAgent.MAX_ITERATIONS) {
        throw new Error(
          `Task did not complete within ${POCAgent.MAX_ITERATIONS} iterations`,
        );
      }
    } catch (error) {
      this._handleExecutionError(error, task);
    } finally {
      try {
        const activeGlows = await this.glowService.getAllActiveGlows();
        for (const tabId of activeGlows) {
          await this.glowService.stopGlow(tabId);
        }
      } catch (error) {
        console.error(`Could not stop glow animation: ${error}`);
      }
    }
  }

  private _initializeExecution(task: string): void {
    this.messageManager.removeSystemMessages();
    this.executionContext.setCurrentTask(task);

    // Generate system prompt with tool descriptions
    const systemPrompt = generateSystemPrompt(
      this.toolManager.getDescriptions(),
    );
    this.messageManager.addSystem(systemPrompt);
    this.messageManager.addHuman(task);
  }

  private _registerTools(): void {
    // Planning tools
    // this.toolManager.register(createPlannerTool(this.executionContext));
    this.toolManager.register(createTodoManagerTool(this.executionContext));
    // this.toolManager.register(createRequirePlanningTool(this.executionContext));

    // Control flow tools
    this.toolManager.register(createDoneTool(this.executionContext));
    this.toolManager.register(createObserveTool(this.executionContext));
    // this.toolManager.register(createContinueTool(this.executionContext));
    this.toolManager.register(createReplanTool(this.executionContext));

    // Navigation tools
    this.toolManager.register(createNavigationTool(this.executionContext));
    this.toolManager.register(createInteractionTool(this.executionContext));
    this.toolManager.register(createScrollTool(this.executionContext));
    this.toolManager.register(createSearchTool(this.executionContext));
    // this.toolManager.register(createRefreshStateTool(this.executionContext));

    // Tab tools
    this.toolManager.register(createTabOperationsTool(this.executionContext));
    // this.toolManager.register(createGroupTabsTool(this.executionContext));
    // this.toolManager.register(createGetSelectedTabsTool(this.executionContext));

    // Validation tool
    // this.toolManager.register(createValidatorTool(this.executionContext));

    // Utility tools
    this.toolManager.register(createScreenshotTool(this.executionContext));
    this.toolManager.register(createStorageTool(this.executionContext));
    this.toolManager.register(createExtractTool(this.executionContext));
    this.toolManager.register(createHumanInputTool(this.executionContext));
    this.toolManager.register(createDateTool(this.executionContext));

    // Result tool
    // this.toolManager.register(createResultTool(this.executionContext));

    // MCP tool for external integrations
    // TODO: enable MCP backs
    // this.toolManager.register(createMCPTool(this.executionContext));

    // Register classification tool last with all tool descriptions
    const toolDescriptions = this.toolManager.getDescriptions();
    this.toolManager.register(
      createClassificationTool(this.executionContext, toolDescriptions),
    );
  }

  private async _executeSingleTurn(
    instruction: string,
  ): Promise<SingleTurnResult> {
    if (instruction) {
      this.messageManager.addHuman(instruction);
    }

    // This method encapsulates the streaming logic
    const llmResponse = await this._invokeLLMWithStreaming();

    const result: SingleTurnResult = {
      doneToolCalled: false,
    };

    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      Logging.log(
        "POCAgent",
        `No of tool_calls: ${llmResponse.tool_calls.length}`,
        "info",
      );

      this.messageManager.add(llmResponse);
      const toolsResult = await this._processToolCalls(llmResponse.tool_calls);
      result.doneToolCalled = toolsResult.doneToolCalled;
    } else if (llmResponse.content) {
      // If the AI responds with text, just add it to the history
      this.messageManager.addAI(llmResponse.content as string);
    } else {
      // if text is empty and no tool calls, AI is stuck, let's force replan
      if (
        llmResponse.content.trim() === "" &&
        llmResponse.tool_calls &&
        llmResponse.tool_calls.length > 0
      ) {
        // agent is stuck, let's observe
        Logging.log("POCAgent", "Agent is stuck, let's replan", "info");
        result.replanToolCalled = true;
      }
    }

    return result;
  }

  private async _invokeLLMWithStreaming(): Promise<AIMessage> {
    const llm = await this.executionContext.getLLM();
    if (!llm.bindTools || typeof llm.bindTools !== "function") {
      throw new Error("This LLM does not support tool binding");
    }

    const message_history = this.messageManager.getMessages();

    const llmWithTools = llm.bindTools(this.toolManager.getAll());
    const stream = await llmWithTools.stream(message_history, {
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
          // Start thinking - handled via streaming
          hasStartedThinking = true;
          // Create message ID on first content chunk
          currentMsgId = PubSub.generateId("msg_assistant");
        }

        // Stream thought chunk - will be handled via assistant message streaming
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
      // Final publish with complete message (in case last chunk was missed)
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
    };

    for (const toolCall of toolCalls) {
      this.checkIfAborted();

      const { name: toolName, args, id: toolCallId } = toolCall;
      Logging.log("POCAgent", `Invoking tool: ${toolName}`, "info");
      const tool = this.toolManager.get(toolName);
      if (!tool) {
        continue;
      }

      await this._maybeStartGlowAnimation(toolName);

      const toolResult = await tool.func(args);
      const parsedResult = jsonParseToolOutput(toolResult);

      if (toolName === "refresh_browser_state_tool" && parsedResult.ok) {
        const simplifiedResult = JSON.stringify({
          ok: true,
          output:
            "Emergency browser state refresh completed - full DOM analysis available",
        });
        this.messageManager.addTool(simplifiedResult, toolCallId);
        this.messageManager.addBrowserState(parsedResult.output);
      } else {
        this.messageManager.addTool(toolResult, toolCallId);
      }

      // Check control flow tools
      if (parsedResult.ok) {
        // Check by tool name
        switch (toolName) {
          case "done_tool":
            result.doneToolCalled = true;
            break;
          case "observe_tool":
            result.observeToolCalled = true;
            break;
          case "continue_tool":
            result.continueToolCalled = true;
            break;
          case "replan_tool":
            result.replanToolCalled = true;
            break;
        }

        // Also check by parsing the output JSON for status field
        if (typeof parsedResult.output === "string") {
          try {
            const outputData = JSON.parse(parsedResult.output);
            if (outputData.status === "observe") {
              result.observeToolCalled = true;
            } else if (outputData.status === "continue") {
              result.continueToolCalled = true;
            } else if (outputData.status === "replan") {
              result.replanToolCalled = true;
            } else if (outputData.status === "done") {
              result.doneToolCalled = true;
            }
          } catch {
            // If not JSON, ignore
          }
        }
      }
    }

    return result;
  }

  private _handleExecutionError(error: unknown, task: string): void {
    const isUserCancellation =
      error instanceof AbortError ||
      this.executionContext.isUserCancellation() ||
      (error instanceof Error && error.name === "AbortError");

    if (isUserCancellation) {
      return;
    } else {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.name : "UnknownError";

      Logging.logMetric("execution_error", {
        error: errorMessage,
        error_type: errorType,
        task: task.substring(0, 200),
        mode: "browse",
        agent: "BrowserAgent",
      });

      console.error("Execution error (already reported by tool):", error);
      throw error;
    }
  }

  private async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    if (!POCAgent.GLOW_ENABLED_TOOLS.has(toolName)) {
      return false;
    }

    try {
      const currentPage =
        await this.executionContext.browserContext.getCurrentPage();
      const tabId = currentPage.tabId;

      if (tabId && !this.glowService.isGlowActive(tabId)) {
        await this.glowService.startGlow(tabId);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Could not manage glow for tool ${toolName}: ${error}`);
      return false;
    }
  }

  private async _planningInterface(
    task: string,
    currentPlan: string | null,
  ): Promise<string> {
    this.pubsub.publishMessage(
      PubSub.createMessage("Planning next steps...", "thinking"),
    );

    // Generate the plan with TODO markdown format
    const plan = await this._generatePlan(task);

    // Setup and display TODOs
    await this._setupTodos(plan);

    // Return the TODO markdown string
    return plan.todoMarkdown;
  }

  private async _generatePlan(task: string): Promise<Plan> {
    const plannerTool = createPlannerTool(this.executionContext);
    const result = await plannerTool.func({ task });
    const parsed = jsonParseToolOutput(result);

    if (parsed.ok && parsed.output?.steps) {
      // Convert steps to markdown TODO format
      const todoMarkdown = parsed.output.steps
        .map((step: any) => `- [ ] ${step.action}`)
        .join("\n");

      const message = `Created ${parsed.output.steps.length} step execution plan`;
      this.pubsub.publishMessage(PubSub.createMessage(message, "thinking"));

      return { todoMarkdown };
    }

    throw new Error(`Unable to generate plan for ${task}`);
  }

  private async _setupTodos(plan: Plan): Promise<void> {
    const todoTool = this.toolManager.get("todo_manager_tool");
    if (!todoTool || !plan.todoMarkdown) return;

    // Set the TODOs using the markdown format (todo_manager_tool expects markdown)
    await todoTool.func({ action: "set", todos: plan.todoMarkdown });

    // Display the TODO list
    const result = await todoTool.func({ action: "get" });
    const parsedResult = jsonParseToolOutput(result);
    const currentTodos = parsedResult.output || "";

    if (currentTodos) {
      this.pubsub.publishMessage(
        PubSub.createMessage(currentTodos, "thinking"),
      );
    }
  }

  private async _captureState(): Promise<CapturedState> {
    try {
      // Get current page from browser context
      const currentPage =
        await this.executionContext.browserContext.getCurrentPage();

      // Get page details (URL, title, tabId)
      const pageDetails = await currentPage.getPageDetails();

      // Get simplified browser state string (DOM elements)
      const domState =
        await this.executionContext.browserContext.getBrowserStateString(false);

      // Take a screenshot (medium size for balance of detail and performance)
      const screenshot = await currentPage.takeScreenshot("medium");

      const state: CapturedState = {
        timestamp: Date.now(),
        currentUrl: pageDetails.url,
        title: pageDetails.title,
        tabId: pageDetails.tabId,
        domState: domState,
        screenshot: screenshot || undefined,
      };

      return state;
    } catch (error) {
      // Log error and return minimal state
      console.error("Error capturing state:", error);
      return {
        timestamp: Date.now(),
        currentUrl: "unknown",
        domState: "Failed to capture browser state",
      };
    }
  }

  private async _observeDecide(
    plan: string | null,
    task: string,
  ): Promise<ObserveDecideResult> {
    this.pubsub.publishMessage(
      PubSub.createMessage(
        "Analyzing current state and deciding next actions...",
        "thinking",
      ),
    );

    let captureObservation = true;
    let state: CapturedState;

    // ObserveDecide loop - keep executing until we need to exit or recapture state
    while (true && this.stepCounter < POCAgent.MAX_ITERATIONS) {
      Logging.log(
        "POCAgent",
        `ObserveDecide loop. Step counter: ${this.stepCounter}`,
        "info",
      );
      this.checkIfAborted();

      this.stepCounter++;

      let instruction = "";
      if (captureObservation) {
        Logging.log("POCAgent", "capturing observation...", "info");
        state = await this._captureState();
        captureObservation = false;

        // Create capture state string similar to the prompt format
        const captureStateString = `## CURRENT BROWSER STATE
- URL: ${state.currentUrl || "Unknown"}
- Title: ${state.title || "Unknown"}
- Tab ID: ${state.tabId || "Unknown"}
- Timestamp: ${new Date(state.timestamp).toISOString()}

### Available Page Elements
${state.domState || "No DOM state available"}`;

        // Add capture state as browser state message
        this.messageManager.addBrowserState(captureStateString);

        // add screenshot to message history
        if (state.screenshot) {
          this.messageManager.addScreenshot(state.screenshot);
        }

        // add instruction to message history
        instruction = generateObserveDecidePrompt(
          state,
          plan,
          task,
          this.stepCounter,
          POCAgent.MAX_ITERATIONS,
        );
      } else {
        instruction = generateSingleTurnExecutionPrompt(plan, task);
      }

      // Execute single turn
      const result = await this._executeSingleTurn(instruction);

      if (this.stepCounter % POCAgent.PLANNING_INTERVAL === 0) {
        Logging.log("POCAgent", "planning interval reached", "info");
        return { replanToolCalled: true };
      }

      // Handle control flow decisions
      if (result.doneToolCalled) {
        // Task complete - exit everything
        Logging.log("POCAgent", "Done tool called", "info");
        return { doneToolCalled: true };
      }
      if (result.replanToolCalled) {
        // Need new plan - exit to trigger replanning
        Logging.log("POCAgent", "Replan tool called", "info");
        return { replanToolCalled: true };
      }

      if (result.observeToolCalled) {
        Logging.log("POCAgent", "Observe tool called", "info");
        captureObservation = true;
        continue;
      }
      captureObservation = true;

      // if (result.continueToolCalled) {
      //   Logging.log(
      //     "POCAgent",
      //     "Continue tool called, planning interval not reached",
      //     "info",
      //   );
      //   captureObservation = false;
      //   continue;
      // }
    }

    // If we get here, we need to replan
    return { doneToolCalled: false, replanToolCalled: true };
  }

  private _shouldPlan(
    stepCount: number,
    needsReplan: boolean,
    currentPlan: string | null,
  ): boolean {
    if (!currentPlan) return true; // No plan yet
    if (needsReplan) return true; // Replan requested
    if (stepCount % POCAgent.PLANNING_INTERVAL === 0) return true; // Periodic replan
    return false;
  }

  private async _validateTaskCompletion(task: string): Promise<{
    isComplete: boolean;
    reasoning: string;
    suggestions: string[];
  }> {
    const validatorTool = this.toolManager.get("validator_tool");
    if (!validatorTool) {
      return {
        isComplete: false,
        reasoning: "Validation skipped - tool not available",
        suggestions: [],
      };
    }

    const args = { task };
    try {
      const result = await validatorTool.func(args);
      const parsedResult = jsonParseToolOutput(result);

      if (parsedResult.ok) {
        const validationData = parsedResult.output;
        const status = validationData.isComplete ? "Complete" : "Incomplete";
        this.pubsub.publishMessage(
          PubSub.createMessage(`Task validation: ${status}`, "thinking"),
        );

        return {
          isComplete: validationData.isComplete,
          reasoning: validationData.reasoning,
          suggestions: validationData.suggestions || [],
        };
      }
    } catch (error) {
      this.pubsub.publishMessage(
        PubSub.createMessage(
          "Error in validator_tool: Validation failed",
          "error",
        ),
      );
    }

    return {
      isComplete: false,
      reasoning: "Validation failed - continuing execution",
      suggestions: [],
    };
  }
}
