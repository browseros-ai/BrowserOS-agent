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
import { createGroupTabsTool } from "@/lib/tools/tab/GroupTabsTool";
import { createGetSelectedTabsTool } from "@/lib/tools/tab/GetSelectedTabsTool";
import { createValidatorTool } from "@/lib/tools/validation/ValidatorTool";
import { createScreenshotTool } from "@/lib/tools/utils/ScreenshotTool";
import { createStorageTool } from "@/lib/tools/utils/StorageTool";
import { createExtractTool } from "@/lib/tools/extraction/ExtractTool";
import { createResultTool } from "@/lib/tools/result/ResultTool";
import { createHumanInputTool } from "@/lib/tools/utils/HumanInputTool";
import { createDateTool } from "@/lib/tools/utility/DateTool";
import { createMCPTool } from "@/lib/tools/mcp/MCPTool";
import { generateSystemPrompt } from "./POCAgent.prompt";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { AbortError } from "@/lib/utils/Abortable";
import { GlowAnimationService } from "@/lib/services/GlowAnimationService";
import { NarratorService } from "@/lib/services/NarratorService";
import { PubSub } from "@/lib/pubsub"; // For static helper methods
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { Logging } from "@/lib/utils/Logging";
import { z } from "zod";
import { jsonParseToolOutput } from "@/lib/utils/utils";

// Type Definitions
interface SingleTurnResult {
  doneToolCalled: boolean;
  requiresHumanInput: boolean;
  success?: boolean; // For React loop
}

export class POCAgent {
  // Human input constants
  private static readonly HUMAN_INPUT_TIMEOUT = 600000; // 10 minutes
  private static readonly HUMAN_INPUT_CHECK_INTERVAL = 500; // Check every 500ms

  // Tools that trigger glow animation when executed
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
  private narrator?: NarratorService; // Narrator service for human-friendly messages

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.toolManager = new ToolManager(executionContext);
    this.glowService = GlowAnimationService.getInstance();
    this.narrator = new NarratorService(executionContext);

    this._registerTools();
  }

  // Getters to access context components
  private get messageManager(): MessageManager {
    return this.executionContext.messageManager;
  }

  private get pubsub(): PubSubChannel {
    return this.executionContext.getPubSub();
  }

  /**
   * Helper method to check abort signal and throw if aborted.
   * Use this for manual abort checks inside loops.
   */
  private checkIfAborted(): void {
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError();
    }
  }

  /**
   * Cleanup method to properly unsubscribe when agent is being destroyed
   */
  public cleanup(): void {
    this.narrator?.cleanup();
  }

  /**
   * Main entry point for POC Agent.
   * Executes tasks using only the ReAct strategy.
   * @param task - The task/query to execute
   * @param metadata - Optional execution metadata for controlling execution mode
   */
  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    try {
      // 1. SETUP: Initialize system prompt and user task
      this._initializeExecution(task);

      // 2. Show starting message
      this.pubsub.publishMessage(
        PubSub.createMessage("Starting ReAct execution...", "thinking"),
      );
    } catch (error) {
      this._handleExecutionError(error, task);
    } finally {
      // Cleanup narrator service
      this.narrator?.cleanup();

      // No status subscription cleanup needed; cancellation is centralized via AbortController

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

  private _initializeExecution(task: string): void {
    // Clear previous system prompts
    this.messageManager.removeSystemMessages();

    // Set the current task in execution context
    this.executionContext.setCurrentTask(task);

    const systemPrompt = generateSystemPrompt(
      this.toolManager.getDescriptions(),
    );
    this.messageManager.addSystem(systemPrompt);
    this.messageManager.addHuman(task);
  }

  private _registerTools(): void {
    // Core tools
    this.toolManager.register(createDoneTool(this.executionContext));

    // Navigation tools
    this.toolManager.register(createNavigationTool(this.executionContext));
    this.toolManager.register(createInteractionTool(this.executionContext));
    this.toolManager.register(createScrollTool(this.executionContext));
    this.toolManager.register(createSearchTool(this.executionContext));
    this.toolManager.register(createRefreshStateTool(this.executionContext));

    // Tab tools
    this.toolManager.register(createTabOperationsTool(this.executionContext));
    this.toolManager.register(createGroupTabsTool(this.executionContext));
    this.toolManager.register(createGetSelectedTabsTool(this.executionContext));

    // Validation tool
    this.toolManager.register(createValidatorTool(this.executionContext));

    // Util tools
    this.toolManager.register(createScreenshotTool(this.executionContext));
    this.toolManager.register(createStorageTool(this.executionContext));
    this.toolManager.register(createExtractTool(this.executionContext));
    this.toolManager.register(createHumanInputTool(this.executionContext));
    this.toolManager.register(createDateTool(this.executionContext));

    // Result tool
    this.toolManager.register(createResultTool(this.executionContext));

    // MCP tool for external integrations
    this.toolManager.register(createMCPTool(this.executionContext));
  }

  // ===================================================================
  //  Shared Core & Helper Logic
  // ===================================================================
  /**
   * Executes a single "turn" with the LLM, including streaming and tool processing.
   * @returns {Promise<SingleTurnResult>} - Information about which tools were called
   */
  private async _executeSingleTurn(
    instruction: string,
  ): Promise<SingleTurnResult> {
    this.messageManager.addHuman(instruction);

    // This method encapsulates the streaming logic
    const llmResponse = await this._invokeLLMWithStreaming();

    console.log(`K tokens:\n${JSON.stringify(llmResponse, null, 2)}`);

    const result: SingleTurnResult = {
      doneToolCalled: false,
      requiresHumanInput: false,
    };

    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      // IMPORTANT: We must add the full AIMessage object (not just a string) to maintain proper conversation history.
      // The AIMessage contains both content and tool_calls. LLMs like Google's API validate that function calls
      // in the conversation history match with their corresponding ToolMessage responses. If we only add a string
      // here, we lose the tool_calls information, causing "function calls don't match" errors.
      this.messageManager.add(llmResponse);
      const toolsResult = await this._processToolCalls(llmResponse.tool_calls);
      result.doneToolCalled = toolsResult.doneToolCalled;
      result.requiresHumanInput = toolsResult.requiresHumanInput;
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
      requiresHumanInput: false,
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

      // Add the result back to the message history for context
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

      if (
        toolName === "human_input_tool" &&
        parsedResult.ok &&
        parsedResult.requiresHumanInput
      ) {
        result.requiresHumanInput = true;
        // Break from the loop immediately to handle human input
        break;
      }
    }

    return result;
  }

  /**
   * Handle execution errors - tools have already published specific errors
   */
  private _handleExecutionError(error: unknown, task: string): void {
    // Check if this is a user cancellation - handle silently
    const isUserCancellation =
      error instanceof AbortError ||
      this.executionContext.isUserCancellation() ||
      (error instanceof Error && error.name === "AbortError");

    if (isUserCancellation) {
      // Don't publish message here - already handled in _subscribeToExecutionStatus
      // when the cancelled status event is received
    } else {
      // Log error metric with details
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.name : "UnknownError";

      Logging.logMetric("execution_error", {
        error: errorMessage,
        error_type: errorType,
        task: task.substring(0, 200), // Truncate long tasks
        mode: "browse",
        agent: "BrowserAgent",
      });

      console.error("Execution error (already reported by tool):", error);
      throw error;
    }
  }

  /**
   * Handle glow animation for tools that interact with the browser
   * @param toolName - Name of the tool being executed
   */
  private async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    // Check if this tool should trigger glow animation
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
      // Log but don't fail if we can't manage glow
      console.error(`Could not manage glow for tool ${toolName}: ${error}`);
      return false;
    }
  }
}
