import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MessageManager } from "@/lib/runtime/MessageManager";
import { ToolManager } from "@/lib/tools/ToolManager";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { createDoneTool } from "@/lib/tools/utils/DoneTool";
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
import { getPlannerPrompt } from "./POCAgent.prompt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

interface SingleTurnResult {
  doneToolCalled: boolean;
  success?: boolean;
}

interface ActionResult {
  doneToolCalled: boolean;
  output?: any;
}

interface ObserveDecideResult {
  actions: Array<{
    type: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    selector?: string;
    instruction?: string;
    tool?: string;
    params?: any;
    reasoning: string;
  }>;
}

interface CapturedState {
  screenshot?: string;
  domState?: string;
  currentUrl?: string;
  timestamp: number;
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

  private checkIfAborted(): void {
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError();
    }
  }

  public cleanup(): void {}

  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    try {
      this._initializeExecution(task);
      this.pubsub.publishMessage(
        PubSub.createMessage("Starting BrowserOS execution...", "thinking"),
      );
      let stepCount = 0;
      let currentPlan: string | null = null;
      let taskComplete = false;
      let actionsLeft: any[] = [];

      while (!taskComplete && stepCount < POCAgent.MAX_ITERATIONS) {
        this.checkIfAborted();

        if (this._shouldPlan(stepCount, actionsLeft, currentPlan)) {
          currentPlan = await this._planningInterface(task, currentPlan);
        }

        const state = await this._captureState();
        const decision = await this._observeDecide(state, currentPlan, task);
        actionsLeft = decision.actions;

        for (const action of decision.actions) {
          this.checkIfAborted();

          const result = await this._executeAction(action);
          await this._recordObservation(action, result);

          if (result.doneToolCalled) {
            taskComplete = true;
            break;
          }
        }

        stepCount++;
      }

      if (!taskComplete && stepCount >= POCAgent.MAX_ITERATIONS) {
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
    this.messageManager.addSystem("You are a browser automation agent.");
    this.messageManager.addHuman(task);
  }

  private _registerTools(): void {
    this.toolManager.register(createDoneTool(this.executionContext));
    this.toolManager.register(createNavigationTool(this.executionContext));
    this.toolManager.register(createInteractionTool(this.executionContext));
    this.toolManager.register(createScrollTool(this.executionContext));
    this.toolManager.register(createSearchTool(this.executionContext));
    this.toolManager.register(createRefreshStateTool(this.executionContext));
    this.toolManager.register(createTabOperationsTool(this.executionContext));
    this.toolManager.register(createScreenshotTool(this.executionContext));
  }

  private async _executeSingleTurn(
    instruction: string,
  ): Promise<SingleTurnResult> {
    this.messageManager.addHuman(instruction);

    // This method encapsulates the streaming logic
    const llmResponse = await this._invokeLLMWithStreaming();

    console.log(`K tokens:\n${JSON.stringify(llmResponse, null, 2)}`);

    const result: SingleTurnResult = {
      doneToolCalled: false,
    };

    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      this.messageManager.add(llmResponse);
      const toolsResult = await this._processToolCalls(llmResponse.tool_calls);
      result.doneToolCalled = toolsResult.doneToolCalled;
    } else if (llmResponse.content) {
      // If the AI responds with text, just add it to the history
      this.messageManager.addAI(llmResponse.content as string);
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

      if (toolName === "done_tool" && parsedResult.ok) {
        result.doneToolCalled = true;
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

    const plannerTool = this._createPlannerTool();
    const history = this.messageManager.getMessages().slice(-10);
    const historyText = history
      .map((m) => m.content)
      .join("\n")
      .substring(0, 1000);

    const result = await plannerTool.func({
      task,
      current_state: await this._captureState(),
      history: historyText,
    });

    const parsed = jsonParseToolOutput(result);
    if (parsed.ok && parsed.output) {
      return parsed.output;
    }

    return `Navigate to the target website and complete the task: ${task}`;
  }

  private _createPlannerTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: "planner_tool",
      description: "Generate a natural language plan for the task",
      schema: z.object({
        task: z.string(),
        current_state: z.any(),
        history: z.string(),
      }),
      func: async (args) => {
        try {
          const llm = await this.executionContext.getLLM();
          const prompt = `${getPlannerPrompt()}
          
Task: ${args.task}
Current State: ${JSON.stringify(args.current_state)}
Recent History: ${args.history}

Generate a concise natural language plan:`;

          const response = await llm.invoke(prompt);
          const plan =
            typeof response.content === "string" ? response.content : "";

          return JSON.stringify({ ok: true, output: plan });
        } catch (error) {
          return JSON.stringify({ ok: false, error: String(error) });
        }
      },
    });
  }

  private async _captureState(): Promise<CapturedState> {
    const state: CapturedState = {
      timestamp: Date.now(),
      currentUrl: "https://example.com",
    };

    return state;
  }

  private async _observeDecide(
    state: CapturedState,
    plan: string | null,
    task: string,
  ): Promise<ObserveDecideResult> {
    this.pubsub.publishMessage(
      PubSub.createMessage(
        "Analyzing current state and deciding next actions...",
        "thinking",
      ),
    );
    return {
      actions: [],
    };
  }

  private async _executeAction(action: any): Promise<ActionResult> {
    const result: ActionResult = {
      doneToolCalled: false,
    };

    return result;
  }

  private async _recordObservation(action: any, result: any): Promise<void> {
    console.log("Recording observation:", { action, result });
  }

  private _shouldPlan(
    stepCount: number,
    actionsLeft: any[],
    currentPlan: string | null,
  ): boolean {
    if (!currentPlan) return true;
    if (stepCount % POCAgent.PLANNING_INTERVAL === 0) return true;
    if (actionsLeft.length === 0) return true;
    return false;
  }
}
