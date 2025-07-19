import { z } from "zod";
import { tool as createLangChainTool } from "@langchain/core/tools";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { ToolConfig } from "./ToolConfig";
import { LangChainProviderFactory, LLMOverrides } from "@/lib/llm";
import { Logging } from "@/lib/utils/Logging";
import BrowserContext from "@/lib/browser/BrowserContext";
import { profileStart, profileEnd } from "@/lib/utils/Profiler";

/**
 * Abstract base class for all Nxtscape tools
 */
export abstract class NxtscapeTool<TInput = any, TOutput = any> {
  protected executionContext: ExecutionContext;
  protected browserContext: BrowserContext;
  protected config: ToolConfig<TInput, TOutput>;
  private llmInstance?: BaseChatModel; // Cached LLM instance
  private llmPromise?: Promise<BaseChatModel>; // Promise to prevent concurrent initialization

  constructor(
    config: ToolConfig<TInput, TOutput>,
    executionContext: ExecutionContext,
  ) {
    this.config = config;
    this.executionContext = executionContext;
    this.browserContext = executionContext.browserContext;
  }

  /**
   * Get an LLM instance for this tool based on user's browser settings
   *
   * The base instance (without overrides) is cached after first creation to avoid multiple
   * initializations and API calls to browser preferences.
   *
   * @param overrides - Optional overrides for model/temperature
   *                    Note: When overrides are provided, a new instance is created without caching
   * @returns Promise resolving to the LLM instance
   *
   * @example
   * // Get default LLM (cached)
   * const llm = await this.getLLM();
   *
   * @example
   * // Get LLM with custom temperature (not cached)
   * const customLLM = await this.getLLM({ temperature: 0.7 });
   */
  protected async getLLM(overrides?: LLMOverrides): Promise<BaseChatModel> {
    // If we have custom overrides, create a new instance without caching
    if (overrides && (overrides.model || overrides.temperature !== undefined)) {
      Logging.log(
        this.config.name,
        "Creating LLM with custom overrides (not cached)",
      );
      return LangChainProviderFactory.createLLM(overrides);
    }

    // Return cached instance if available
    if (this.llmInstance) {
      return this.llmInstance;
    }

    // If already initializing, wait for the existing promise
    if (this.llmPromise) {
      return this.llmPromise;
    }

    // Initialize LLM with proper error handling and concurrency protection
    this.llmPromise = LangChainProviderFactory.createLLM()
      .then((llm) => {
        this.llmInstance = llm;
        Logging.log(this.config.name, "LLM initialized and cached for tool");
        return llm;
      })
      .catch((error) => {
        // Clear the promise on error so it can be retried
        this.llmPromise = undefined;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        Logging.log(
          this.config.name,
          `Failed to initialize LLM: ${errorMessage}`,
          "error",
        );
        throw error;
      });

    return this.llmPromise;
  }

  /**
   * Execute the tool with input validation and output formatting
   */
  protected abstract execute(input: TInput): Promise<TOutput>;

  /**
   * Format tool output for UI display
   * Each tool MUST implement this method to format its own output
   * @param output - The validated tool output
   * @returns Formatted string ready for UI display
   */
  abstract FormatResultForUI(output: TOutput): string;

  /**
   * Get the tool configuration
   */
  getConfig(): ToolConfig<TInput, TOutput> {
    return this.config;
  }

  /**
   * Get the LangChain-compatible tool with enhanced display result
   */
  getLangChainTool() {
    return createLangChainTool(
      async (input: any) => {
        const profileLabel = `Tool.${this.config.name}`;
        profileStart(profileLabel);
        
        try {
          // Validate input
          const validatedInput = this.config.inputSchema.parse(input);

          // Execute tool
          const result = await this.execute(validatedInput);

          // Validate output
          const validatedOutput = this.config.outputSchema.parse(result);

          // Create enhanced result with display formatting
          const enhancedResult = {
            ...validatedOutput,
            _displayResult: this.FormatResultForUI(validatedOutput), // Add display-ready result
            _toolName: this.config.name, // Add tool name for identification
          };

          // Return as JSON string for LangChain compatibility
          profileEnd(profileLabel);
          return JSON.stringify(enhancedResult);
        } catch (error) {
          profileEnd(profileLabel);
          
          // Handle validation errors
          if (error instanceof z.ZodError) {
            const errorMessage = `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`;
            const errorResult = {
              success: false,
              error: errorMessage,
              _displayResult: `❌ ${errorMessage}`,
              _toolName: this.config.name,
            };
            return JSON.stringify(errorResult);
          }

          // Handle other errors
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorResult = {
            success: false,
            error: errorMessage,
            _displayResult: `❌ ${errorMessage}`,
            _toolName: this.config.name,
          };
          return JSON.stringify(errorResult);
        }
      },
      {
        name: this.config.name,
        description: this.config.description,
        schema: this.config.inputSchema,
      },
    );
  }

  /**
   * Get streaming display configuration
   */
  getUIConfig() {
    return (
      this.config.streamingConfig || {
        displayName: this.config.name,
        icon: "🔧",
        progressMessage: `Running ${this.config.name}...`,
      }
    );
  }

  /**
   * Generate contextual display message based on tool arguments
   * Each tool MUST implement this method to provide specific messages based on their input
   * @param args - Tool arguments of type TInput
   * @returns Contextual display message
   */
  abstract getProgressMessage(args: TInput): string;

  /**
   * Get display information for streaming
   * @param args - Tool arguments of type TInput
   * @returns Complete display information
   */
  getToolMetadata(args: TInput): {
    displayName: string;
    icon: string;
    description: string;
  } {
    const streamingConfig = this.getUIConfig();

    return {
      displayName: streamingConfig.displayName || this.config.name,
      icon: streamingConfig.icon || "🔧",
      description: this.getProgressMessage(args),
    };
  }

}

