import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { TaskMetadata } from "@/lib/types/types";
import { Logging } from "@/lib/utils/Logging";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StreamEvent } from "@langchain/core/dist/tracers/event_stream";
import { LangChainProviderFactory } from "@/lib/llm";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { BaseMessage } from "@langchain/core/messages";
import { profileStart, profileEnd } from "@/lib/utils/Profiler";

// Import streaming components
import { StreamEventBus } from "@/lib/events";
import { StreamEventProcessor } from "../events/StreamEventProcessor";
// Removed deprecated IStreamProcessor import
import { ToolRegistry } from "@/lib/tools/base/ToolRegistry";
import BrowserContext from "../browser/BrowserContext";
import { getDomainFromUrl } from "../browser/Utils";
import { Runnable } from "@langchain/core/runnables";
import { RunnableConfig } from "@langchain/core/runnables";

/**
 * Input schema for agent execution
 */
export const AgentInputSchema = z.object({
  instruction: z.string(), // The task instruction
  // Additional context you can pass -- different agents pass different additional context -- like BrowserAgent passes browserState, ProductivityAgent passes selectedTabIds, etc.
  context: z.record(z.unknown()).optional(),
  browserState: z.record(z.unknown()).optional(), // Current browser state
});

export type AgentInput = z.infer<typeof AgentInputSchema>;

/**
 * Base output schema that all agents must conform to
 */
export const AgentOutputSchema = z.object({
  success: z.boolean(), // Whether the execution completed successfully
  result: z.unknown(), // Agent-specific result data
  error: z.string().optional(), // Error message if failed
  metadata: z.record(z.unknown()).optional(), // Additional metadata
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

/**
 * Base configuration options for agents
 */
export const AgentOptionsSchema = z.object({
  executionContext: z.instanceof(ExecutionContext), // Execution context instance
  systemPrompt: z.string().optional(), // Optional custom system prompt
  maxIterations: z.number().int().positive().default(10), // Maximum iterations for ReAct agents
  useVision: z.boolean().default(false), // Whether to enable vision
  debugMode: z.boolean().default(false), // Debug logging
});

export type AgentOptions = z.infer<typeof AgentOptionsSchema>;

/**
 * Interface for all agent types - now extends Runnable for LangGraph compatibility
 *
 * RunnableConfig: Runtime configuration object that controls execution behavior across LangChain components.
 * Key properties:
 * - configurable: Dynamic runtime values (e.g., {sessionId: "123", temperature: 0.7})
 * - callbacks: Event handlers for streaming, errors, and progress tracking
 * - recursionLimit: Max depth for ReAct loops (default: 25)
 * - maxConcurrency: Parallel execution limit
 * - timeout: Execution timeout in milliseconds
 * - signal: AbortSignal for cancellation
 * - tags/metadata: Tracking and debugging info
 *
 * The config propagates through the entire execution pipeline, maintaining context,
 * callbacks, and control flow. Essential for streaming, cancellation, and observability.
 */
export interface IAgent extends Runnable<AgentInput, AgentOutput> {
  /**
   * Execute a task with the given input
   * @param input - Agent input containing instruction and context
   * @param config - Runtime configuration controlling execution behavior, callbacks, and context propagation
   * @returns Promise resolving to structured output
   */
  invoke(input: AgentInput, config?: RunnableConfig): Promise<AgentOutput>;
}

/**
 * Abstract base class for LangChain-based agents.
 * Uses two-phase initialization to avoid constructor virtual method call issues.
 * LLM provider is created lazily to always use the latest user settings.
 */
export abstract class BaseAgent
  extends Runnable<AgentInput, AgentOutput>
  implements IAgent
{
  protected readonly options: AgentOptions;
  protected readonly executionContext: ExecutionContext; // Execution context from options
  protected readonly browserContext: BrowserContext;

  // LangChain namespace requirement
  lc_namespace = ["nxtscape", "agents"];

  // These get set during initialize()
  protected systemPrompt!: string;
  protected toolRegistry!: ToolRegistry;
  protected isInitialized: boolean = false;
  protected debugMode: boolean;

  // State management for derived agents
  protected stateMessageAdded: boolean = false;
  protected systemPromptAdded: boolean = false;
  
  // Store current EventBus for streaming
  protected currentEventBus: StreamEventBus | null = null;

  /**
   * Creates a new instance of BaseAgent
   * @param options - Configuration options for the agent
   */
  constructor(options: AgentOptions) {
    super();
    this.options = AgentOptionsSchema.parse(options);
    this.executionContext = this.options.executionContext;
    this.browserContext = this.executionContext.browserContext;
    this.debugMode = this.options.debugMode || this.executionContext.debugMode;
  }

  /**
   * Initialize the agent by calling virtual methods to set up tools and system prompt
   * This must be called after construction before using the agent
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }

    try {
      // Now it's safe to call virtual methods
      this.toolRegistry = this.createToolRegistry();
      this.systemPrompt =
        this.options.systemPrompt || this.generateSystemPrompt();

      this.isInitialized = true;

      if (this.debugMode) {
        this.log(
          `${this.getAgentName()} initialized (LLM will be created lazily)`
        );
      }
    } catch (error) {
      this.log(
        `Failed to initialize ${this.getAgentName()}: ${error}`,
        "error"
      );
      throw error;
    }
  }

  /**
   * Ensure the agent is initialized before execution
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Template method: Get agent-specific initialization message
   * @returns Initialization message
   */
  protected getInitializationMessage(): string {
    return `🚀 Initializing ${this.getAgentName().toLowerCase()}...`;
  }

  /**
   * Main execution method - implements Runnable interface
   * This is called by LangGraph as a node function
   * @param input - Agent input containing instruction and context
   * @param config - Optional configuration for LangGraph web compatibility
   * @returns Promise resolving to agent output
   */
  public async invoke(
    input: AgentInput,
    config?: RunnableConfig,
  ): Promise<AgentOutput> {
    const validatedInput = AgentInputSchema.parse(input);
    const profileLabel = `Agent.${this.getAgentName()}`;
    
    profileStart(profileLabel);

    try {
      await this.ensureInitialized();
      
      // Extract EventBus from ExecutionContext only
      this.currentEventBus = this.executionContext.getEventBus();

      if (this.debugMode) {
        this.log(
          `🚀🚀 Starting ${this.getAgentName()} execution: ${
            validatedInput.instruction
          }`
        );
        this.log(`🚀🚀 Starting ${this.getAgentName()} task...`);
      }

      // Execute agent-specific logic - each agent handles its own orchestration
      const agentResult = await this.executeAgent(
        validatedInput,
        config
      );

      // Log completion internally for debugging
      if (this.debugMode) {
        this.log(`✅✅ ${this.getAgentName()} completed successfully`);
      }
      // Removed automatic completion message - let Orchestrator handle final completion

      return {
        success: true,
        result: agentResult,
        metadata: {
          agentName: this.getAgentName(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isAbortError =
        error instanceof Error &&
        (error.name === "AbortError" ||
          errorMessage.includes("Aborted") ||
          errorMessage.includes("cancelled") ||
          errorMessage.includes("stopped"));

      if (!isAbortError) {
        this.log(`❌ ${this.getAgentName()} failed: ${errorMessage}`, "error");
        // Send error message only for non-cancellation errors
        this.currentEventBus?.emitSystemError(
          errorMessage,
          error instanceof Error ? error : undefined,
          this.getAgentName()
        );
        this.currentEventBus?.emitSystemMessage(
          `❌ ${this.getAgentName()} failed: ${errorMessage}`,
          'error',
          this.getAgentName()
        );
      } else {
        this.log(`${this.getAgentName()} cancelled: ${errorMessage}`, "info");
      }

      return {
        success: false,
        result: null,
        error: errorMessage,
        metadata: {
          agentName: this.getAgentName(),
          timestamp: new Date().toISOString(),
          cancelled: isAbortError,
        },
      };
    } finally {
      // Clear EventBus after execution
      this.currentEventBus = null;
      profileEnd(profileLabel);
    }
  }

  /**
   * Helper method for centralized streaming execution that agents can use
   * @param agent - The created ReAct agent
   * @param instruction - The instruction to execute
   * @param config - Optional configuration for LangGraph web compatibility
   * @param messages - Optional messages array
   * @returns Object containing result and all messages
   */
  protected async executeReactAgentWithStreaming(
    agent: any,
    instruction: string,
    config?: RunnableConfig,
    messages?: BaseMessage[]
  ): Promise<{ result: any; allMessages: any[] }> {
    const profileLabel = `${this.getAgentName()}.invokeWithStreaming`;
    profileStart(profileLabel);
    
    // Extract EventBus from ExecutionContext only - single source of truth
    const eventBus = this.executionContext.getEventBus();
    if (!eventBus) {
      throw new Error('EventBus not available in ExecutionContext - ensure setEventBus() was called');
    }
    
    // Store EventBus for use in log() method during streaming
    this.currentEventBus = eventBus;
    
    // CENTRALIZED STREAMING LOGIC
    eventBus.emitThinking(
      `🔧 Setting up ${this.getAgentName()} tools`,
      'info',
      this.getAgentName()
    );

    // Use the existing tool registry instead of creating a new one
    const toolRegistry = this.getToolRegistry();

    if (!toolRegistry) {
      throw new Error(`Tool registry not available for ${this.getAgentName()}`);
    }

    if (this.debugMode) {
      this.log(
        `Using existing tool registry with ${
          toolRegistry.getAll().length
        } tools`
      );
    }

    // Initialize StreamEventProcessor with EventBus and existing tool registry
    const streamEventProcessor = new StreamEventProcessor(
      eventBus,
      toolRegistry
    );

    if (this.debugMode) {
      this.log(`StreamEventProcessor initialized with existing tool registry`);
    }

    // Check if already cancelled before starting
    if (this.executionContext.abortController.signal.aborted) {
      throw new Error("Task was cancelled before execution");
    }

    const eventStream = await agent.streamEvents(
      {
        messages: messages || [new HumanMessage(instruction)],
      },
      {
        version: "v2",
        signal: this.executionContext.abortController.signal,
        recursionLimit: this.options.maxIterations,
        ...config,
      }
    );

    let result: any;
    let allMessages: any[] = [];
    let wasCancelled = false;

    try {
      // Process streaming events using StreamProcessor
      for await (const event of eventStream) {
        // Check for cancellation
        if (this.executionContext.abortController.signal.aborted) {
          wasCancelled = true;
          break;
        }

        // Delegate all event processing to StreamEventProcessor
        await streamEventProcessor.processEvent(event);

        // sync langchain and message manager
        await this.syncLangchainAndMessageManager(event, streamEventProcessor);

        // Extract result from any chain end event that contains messages
        if (event.event === "on_chain_end") {
          const output = event.data?.output;

          // Store the first string output as a fallback in case we never see messages
          if (result === undefined && typeof output === "string") {
            result = output;
          }

          if (output && typeof output === "object" && Array.isArray(output.messages)) {
            // We found the rich output that carries the full message list
            result = output;
            allMessages = output.messages;
          }
        }
      }
    } catch (error) {
      // Handle specific known errors
      if (error instanceof Error) {
        if (
          error.message.includes("ToolNode only accepts AIMessages as input")
        ) {
          // Known LangGraph streaming issue that doesn't affect execution
          this.log(
            "Encountered known LangGraph streaming issue - continuing execution",
            "info"
          );
        } else if (error.name === "AbortError") {
          wasCancelled = true;
          this.log("Task was cancelled by user", "info");
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Complete streaming
    streamEventProcessor.completeStreaming();

    // Handle cancellation
    if (wasCancelled) {
      eventBus.emitCancel('Task was cancelled', true, this.getAgentName());
      profileEnd(profileLabel);
      throw new Error("Task was cancelled");
    }

    profileEnd(profileLabel);
    return { result, allMessages };
  }

  /**
   * Template method: Get the agent name for logging
   * @returns Agent name
   */
  protected abstract getAgentName(): string;

  /**
   * Template method: Execute agent-specific logic
   * Each agent handles its own instruction enhancement, agent creation, and execution
   * @param input - Agent input containing instruction and context
   * @param config - Optional configuration for LangGraph web compatibility
   * @returns Parsed agent-specific output
   */
  protected abstract executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<unknown>;

  /**
   * Template method: Create tool registry for the agent
   * @returns Tool registry or undefined
   */
  protected createToolRegistry(): ToolRegistry {
    // Default implementation returns undefined
    // Subclasses can override to provide a tool registry
    throw new Error("createToolRegistry must be implemented by subclasses");
  }

  /**
   * Template method: Create agent-specific tools
   * @returns Array of tools for the agent
   */
  protected createTools(): any[] {
    return this.toolRegistry?.getLangChainTools() || [];
  }

  /**
   * Template method: Get tool registry for streaming display
   * @returns Tool registry or undefined
   */
  protected getToolRegistry(): ToolRegistry | undefined {
    return this.toolRegistry;
  }

  /**
   * Get LLM provider using current user settings
   * This method creates the LLM fresh each time to ensure latest settings are used
   * @returns Promise resolving to configured LLM provider
   */
  protected async getLLM(): Promise<BaseChatModel> {
    try {
      const llm = await LangChainProviderFactory.createLLM();

      return llm;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log(`Failed to create LLM provider: ${errorMessage}`, "error");
      throw new Error(`LLM provider creation failed: ${errorMessage}`);
    }
  }

  /**
   * Template method: Generate the system prompt for this agent
   * @returns System prompt string
   */
  protected abstract generateSystemPrompt(): string;

  protected async enhanceInstructionWithContext(
    instruction: string
  ): Promise<string> {
    try {
      const pageUrl = await this.browserContext.getCurrentPage().then(p => p.url());  
      const pageTitle = await this.browserContext.getCurrentPage().then(p => p.title());

      return `${instruction}\n\n## BROWSER CONTEXT\nCurrent URL: ${pageUrl}\nPage Title: ${pageTitle}`;
    } catch (error) {
      this.log(
        `Failed to enhance instruction with context: ${error}`,
        "warning"
      );
      return instruction;
    }
  }


  protected async getSelectedTabsInstruction(): Promise<string> {
    const selectedTabIds =
      this.executionContext.getSelectedTabIds() || undefined;

    // User has selected tabs
    if (selectedTabIds && selectedTabIds.length > 1) {
      // Multi-tab context - get detailed information about all selected tabs
      const tabInfoList: Array<{
        id: number;
        title: string;
        url: string;
        domain: string;
      }> = [];

      for (const tabId of selectedTabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const tabDomain = getDomainFromUrl(tab.url || "unknown");

          tabInfoList.push({
            id: tabId,
            title: tab.title || "Untitled",
            url: tab.url || "about:blank",
            domain: tabDomain,
          });
        } catch (error) {
          // If tab can't be accessed, add basic info don't add it to the list
        }
      }

      let selectedTabsInstruction = `## USER TAB SELECTED CONTEXT\n🔗 **User has selected ${
        tabInfoList.length
      } tabs:**\n\nJSON: ${JSON.stringify(tabInfoList)}`;

      selectedTabsInstruction += `\n\n**TAB PROCESSING INSTRUCTIONS:**\n• Content from all ${tabInfoList.length} tabs should be considered collectively\n• When summarizing or analyzing, include information from all selected tabs\n• Mention which tabs specific information comes from when relevant\n• Consider relationships and connections between the different tabs`;
      return selectedTabsInstruction;
    }

    return "";
  }

  protected async syncLangchainAndMessageManager(
    event: StreamEvent,
    streamEventProcessor?: StreamEventProcessor
  ): Promise<void> {
    try {
      if (event.event === "on_chat_model_end") {
        // on_chat_model_end is called when the chat model is done
        // This could either AIChunk message -- which is AI thinking; where content is present
        // This could also be AI calling the tool -- which is AI calling the tool where content is not present
        // we want to extract the output of that message and add to our message manager
        // Tip: Put breakpoint here to see how the event looks like

        if (event.data?.output instanceof AIMessageChunk) {
          this.executionContext.messageManager.addAIMessage(
            event.data?.output.text
          );
        }
      } else if (event.event === "on_tool_end") {
        // on_tool_end is called when a tool is executed
        // we want to extract the output of that message and add to our message manager
        // Tip: Put breakpoint here to see how the event looks like

        const output = event.data?.output;
        const toolName = event.name || "unknown";

        if (
          output &&
          streamEventProcessor &&
          "getActionResults" in streamEventProcessor
        ) {
          const actionResults = streamEventProcessor.getActionResults();

          // Find the most recent ActionResult for this tool
          const recentResult = actionResults
            .filter((ar: any) => ar.toolName === toolName)
            .pop();

          if (recentResult && recentResult.includeInMemory) {
            // Use extracted content if available (for search_text and interact)
            const contentToAdd =
              recentResult.extractedContent ||
              (output instanceof ToolMessage
                ? (output.content as string)
                : typeof output === "string"
                ? output
                : JSON.stringify(output));

            this.executionContext.messageManager.addToolMessage(
              contentToAdd,
              toolName
            );
          }
        }
      }
      // For other event types, we don't need to sync yet
    } catch (error) {
      // Log the error but don't throw to avoid breaking the stream
      this.log(`Error syncing LangChain and MessageManager: ${error}`, "error");
    }
  }

  /**
   * Log a message if debug mode is enabled
   * @param message - Message to log
   * @param level - Log level
   * @param data - Optional structured data for debugging
   */
  protected log(
    message: string,
    level: "info" | "warning" | "error" = "info",
    data?: any
  ): void {
    // Always log to console in debug mode or for errors
    if (this.debugMode || level === "error") {
      Logging.log(this.getAgentName(), message, level);
    }
    
    // Send to UI via EventBus if debug mode is on and EventBus is available
    if (this.debugMode && this.currentEventBus && level !== "error") {
      this.currentEventBus.emitDebugMessage(`[${this.getAgentName()}] ${message}`, data, this.getAgentName());
    }
  }

  public async cleanup(): Promise<void> {
    try {
      await this.executionContext.browserContext.cleanup();
    } catch (error) {
      this.log(`Failed to cleanup browser context: ${error}`, "error");
    }
  }
}
