/**
 * POCAgent - Proof of Concept agent using only ReAct strategy for browser automation
 * 
 * ## Streaming Architecture
 * 
 * Currently, BrowserAgent uses llm.invoke() which waits for the entire response before returning. 
 * With streaming:
 * - Users see the AI "thinking" in real-time
 * - Tool calls appear as they're being decided
 * - No long waits with blank screens
 * 
 * ### How Streaming Works in LangChain
 * 
 * Current approach (blocking):
 * ```
 * const response = await llm.invoke(messages);  // Waits for complete response
 * ```
 * 
 * Streaming approach:
 * ```
 * const stream = await llm.stream(messages);    // Returns immediately
 * for await (const chunk of stream) {
 *   // Process each chunk as it arrives
 * }
 * ```
 * 
 * ### Stream Chunk Structure
 * 
 * Each chunk contains:
 * ```
 * {
 *   content: string,           // Text content (may be empty)
 *   tool_calls: [],           // Tool calls being formed
 *   tool_call_chunks: []      // Progressive tool call building
 * }
 * ```
 * 
 * Tool calls build progressively in the stream:
 * - Chunk 1: { tool_call_chunks: [{ name: 'navigation_tool', args: '', id: 'call_123' }] }
 * - Chunk 2: { tool_call_chunks: [{ name: 'navigation_tool', args: '{"url":', id: 'call_123' }] }
 * - Chunk 3: { tool_call_chunks: [{ name: 'navigation_tool', args: '{"url": "https://example.com"}', id: 'call_123' }] }
 */

import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManager } from '@/lib/runtime/MessageManager';
import { ToolManager } from '@/lib/tools/ToolManager';
import { ExecutionMetadata } from '@/lib/types/messaging';
import { createDoneTool } from '@/lib/tools/utils/DoneTool';
import { createNavigationTool } from '@/lib/tools/navigation/NavigationTool';
import { createInteractionTool } from '@/lib/tools/navigation/InteractionTool';
import { createScrollTool } from '@/lib/tools/navigation/ScrollTool';
import { createSearchTool } from '@/lib/tools/navigation/SearchTool';
import { createRefreshStateTool } from '@/lib/tools/navigation/RefreshStateTool';
import { createTabOperationsTool } from '@/lib/tools/tab/TabOperationsTool';
import { createGroupTabsTool } from '@/lib/tools/tab/GroupTabsTool';
import { createGetSelectedTabsTool } from '@/lib/tools/tab/GetSelectedTabsTool';
import { createValidatorTool } from '@/lib/tools/validation/ValidatorTool';
import { createScreenshotTool } from '@/lib/tools/utils/ScreenshotTool';
import { createStorageTool } from '@/lib/tools/utils/StorageTool';
import { createExtractTool } from '@/lib/tools/extraction/ExtractTool';
import { createResultTool } from '@/lib/tools/result/ResultTool';
import { createHumanInputTool } from '@/lib/tools/utils/HumanInputTool';
import { createDateTool } from '@/lib/tools/utility/DateTool';
import { createMCPTool } from '@/lib/tools/mcp/MCPTool';
import { 
  generateSystemPrompt,
  getReactSystemPrompt,
  getReactObservationPrompt,
  getReactThinkingPrompt,
  getReactRefineFocusPrompt
} from './POCAgent.prompt';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { AbortError } from '@/lib/utils/Abortable';
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';
import { NarratorService } from '@/lib/services/NarratorService';
import { PubSub } from '@/lib/pubsub'; // For static helper methods
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel';
import { HumanInputResponse, PubSubEvent } from '@/lib/pubsub/types';
import { Logging } from '@/lib/utils/Logging';
import { z } from 'zod';
import { trimToMaxTokens } from '@/lib/utils/llmUtils';
import { jsonParseToolOutput } from '@/lib/utils/utils';
import { 
  Observation, 
  Thought, 
  ReactState, 
  ReactStateImpl,
  REACT_CONFIG 
} from './ReactLoopImpl';

// Type Definitions
interface SingleTurnResult {
  doneToolCalled: boolean;
  requiresHumanInput: boolean;
  success?: boolean;  // For React loop
}

export class POCAgent {
  // Human input constants
  private static readonly HUMAN_INPUT_TIMEOUT = 600000;  // 10 minutes
  private static readonly HUMAN_INPUT_CHECK_INTERVAL = 500;  // Check every 500ms 

  // Tools that trigger glow animation when executed
  private static readonly GLOW_ENABLED_TOOLS = new Set([
    'navigation_tool',
    'interact_tool',
    'scroll_tool',
    'search_tool',
    'refresh_browser_state_tool',
    'tab_operations_tool',
    'screenshot_tool',
    'extract_tool'
  ]);

  private readonly executionContext: ExecutionContext;
  private readonly toolManager: ToolManager;
  private readonly glowService: GlowAnimationService;
  private narrator?: NarratorService;  // Narrator service for human-friendly messages

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
    if (this.executionContext.abortController.signal.aborted) {
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
        PubSub.createMessage('Starting ReAct execution...', 'thinking')
      );

      // 3. EXECUTE: Run React strategy directly
      await this._executeReactStrategy(task);

      // 4. FINALISE: Generate final result
      await this._generateTaskResult(task);
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

    const systemPrompt = generateSystemPrompt(this.toolManager.getDescriptions());
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
  //  Execution Strategy 3: ReAct Loop (Observation → Thinking → Action)
  // ===================================================================
  private async _executeReactStrategy(task: string): Promise<void> {
    // Add React-specific system message
    this.messageManager.addSystem(getReactSystemPrompt());
    this.pubsub.publishMessage(PubSub.createMessage('Starting ReAct execution loop...', 'thinking'));
    
    // Outer validation loop
    for (let validationAttempt = 0; validationAttempt < REACT_CONFIG.MAX_VALIDATION_ATTEMPTS; validationAttempt++) {
      this.checkIfAborted();
      
      // Initialize state for this validation attempt
      const state = new ReactStateImpl(task);
      
      // Inner React loop
      for (let cycle = 0; cycle < REACT_CONFIG.MAX_REACT_CYCLES; cycle++) {
        this.checkIfAborted();
        
        // Check for loops
        if (this._detectLoop()) {
          console.warn('Detected repetitive behavior. Breaking to re-validate.');
          break;  // Break inner loop to trigger validation
        }
        
        // 1. OBSERVE - See current state
        const observation = await this._observe(state);
        
        // 2. THINK - Decide next action based on observation
        const thought = await this._think(state, observation);
        
        // 3. ACT - Execute the action
        const actionResult = await this._act(thought);
        
        // 4. UPDATE - Record this cycle
        state.addCycle(observation, thought, actionResult);
        
        // 5. CHECK - See if we're done
        if (actionResult.doneToolCalled) {
          return;  // Task complete, exit entire strategy
        }
        
        // Update focus based on result
        if (!actionResult.success) {
          state.currentFocus = await this._refineFocus(state, actionResult);
        }
      }
      
      // After inner loop, validate if task is complete
      const validationResult = await this._validateTaskCompletion(task);
      if (validationResult.isComplete) {
        return;  // Task validated as complete
      }
      
      // Add validation feedback for next attempt
      if (validationResult.suggestions.length > 0) {
        const validationMessage = `Validation result: ${validationResult.reasoning}\nSuggestions for next attempt: ${validationResult.suggestions.join(', ')}`;
        this.messageManager.addAI(validationMessage);
        this.pubsub.publishMessage(PubSub.createMessage(`Validation: Task incomplete. Retrying with adjustments...`, 'thinking'));
      }
    }
    
    throw new Error(`Task incomplete after ${REACT_CONFIG.MAX_VALIDATION_ATTEMPTS} validation attempts`);
  }

  /**
   * Observe the current state using screenshot and browser state tools
   */
  private async _observe(state: ReactState): Promise<Observation> {
    // Take a screenshot using existing tool
    const screenshotTool = this.toolManager.get('screenshot_tool');
    if (!screenshotTool) {
      throw new Error('Screenshot tool not available');
    }
    
    let screenshot = '';
    
    try {
      const screenshotResult = await screenshotTool.func({ size: 'medium' });
      const parsedScreenshot = jsonParseToolOutput(screenshotResult);
      if (parsedScreenshot.ok) {
        screenshot = parsedScreenshot.output?.screenshot || '';  // Base64 encoded
      }
    } catch (error) {
      console.warn('Failed to capture screenshot:', error);
    }
    
    // Get browser state using refresh_state tool (every cycle as requested)
    let browserState: any = {};
    const refreshTool = this.toolManager.get('refresh_browser_state_tool');
    if (refreshTool) {
      try {
        const stateResult = await refreshTool.func({});
        const parsedState = jsonParseToolOutput(stateResult);
        if (parsedState.ok) {
          browserState = parsedState.output || {};
        }
      } catch (error) {
        console.warn('Failed to get browser state:', error);
      }
    }
    
    // Get observation explanation from LLM
    const llm = await this.executionContext.getLLM();
    const observationPrompt = getReactObservationPrompt(screenshot, browserState, state.currentFocus);
    
    // Trim prompt if needed to fit token limits
    const trimmedPrompt = trimToMaxTokens(observationPrompt, this.executionContext);  // Uses default 20% reserve
    const explanation = await llm.invoke(trimmedPrompt);
    
    const observation: Observation = {
      screenshot: screenshot,
      browserState: browserState,
      explanation: explanation.content as string
    };
    
    // Publish observation
    this.pubsub.publishMessage(
      PubSub.createMessage(`Observing: ${observation.explanation.substring(0, 150)}...`, 'thinking')
    );
    
    return observation;
  }

  /**
   * Think about the next action based on observation
   */
  private async _think(state: ReactState, observation: Observation): Promise<Thought> {
    const llm = await this.executionContext.getLLM();
    
    // Build context and get thinking prompt
    const context = state.getContext();
    const toolNames = this.toolManager.getAll().map(tool => tool.name);
    const prompt = getReactThinkingPrompt(context, observation.explanation, toolNames);
    
    // Trim prompt if needed to fit token limits
    const trimmedPrompt = trimToMaxTokens(prompt, this.executionContext);  // Uses default 20% reserve
    
    // Define schema for structured thinking
    const ThoughtSchema = z.object({
      reasoning: z.string().describe('Your thought process (1-2 sentences)'),
      toolName: z.string().describe('The single tool to use')
    });
    
    // Get structured thought from LLM
    const structuredLLM = llm.withStructuredOutput(ThoughtSchema);
    const result = await structuredLLM.invoke(trimmedPrompt);
    
    // Cast to Thought type
    const thought: Thought = {
      reasoning: result.reasoning,
      toolName: result.toolName
    };
    
    // Publish thinking
    this.pubsub.publishMessage(
      PubSub.createMessage(`Thinking: ${thought.reasoning}`, 'thinking')
    );
    
    return thought;
  }

  /**
   * Execute action using the existing tool processing infrastructure
   */
  private async _act(thought: Thought): Promise<SingleTurnResult> {
    // Publish action intent
    this.pubsub.publishMessage(
      PubSub.createMessage(`Acting: ${thought.toolName}`, 'assistant')
    );
    
    // Generate proper tool call using LLM with tool binding
    const llm = await this.executionContext.getLLM();
    if (!llm.bindTools || typeof llm.bindTools !== 'function') {
      throw new Error('This LLM does not support tool binding');
    }
    const llmWithTools = llm.bindTools(this.toolManager.getAll());
    const actionPrompt = `Execute this action: ${thought.reasoning}
    
Use the ${thought.toolName} tool to accomplish this.`;
    
    // Trim prompt if needed to fit token limits
    const trimmedPrompt = trimToMaxTokens(actionPrompt, this.executionContext, 0.15);  // 15% reserve for tool binding
    
    const response = await llmWithTools.invoke(trimmedPrompt);
    
    // Process the tool calls if any were generated
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Add the AIMessage with tool_calls to maintain proper history
      this.messageManager.add(response);
      const result = await this._processToolCalls(response.tool_calls);
      
      return {
        ...result,
        success: true  // Tool calls were executed
      };
    }
    
    // If no tool calls were generated, return failure
    return {
      doneToolCalled: false,
      requiresHumanInput: false,
      success: false
    };
  }

  /**
   * Refine focus based on last action result
   */
  private async _refineFocus(state: ReactState, result: SingleTurnResult): Promise<string> {
    // Simple focus refinement based on last action result
    if (!result.success) {
      return `Retry: ${state.currentFocus}`;
    }
    
    // Ask LLM for next focus area
    const llm = await this.executionContext.getLLM();
    const prompt = getReactRefineFocusPrompt(
      state.ultimateGoal,
      state.currentFocus,
      result
    );
    
    // Trim prompt if needed to fit token limits
    const trimmedPrompt = trimToMaxTokens(prompt, this.executionContext, 0.125);  // 12.5% reserve
    
    const response = await llm.invoke(trimmedPrompt);
    return response.content as string;
  }

  // ===================================================================
  //  Shared Core & Helper Logic
  // ===================================================================
  /**
   * Executes a single "turn" with the LLM, including streaming and tool processing.
   * @returns {Promise<SingleTurnResult>} - Information about which tools were called
   */
  private async _executeSingleTurn(instruction: string): Promise<SingleTurnResult> {
    this.messageManager.addHuman(instruction);
    
    // This method encapsulates the streaming logic
    const llmResponse = await this._invokeLLMWithStreaming();

    console.log(`K tokens:\n${JSON.stringify(llmResponse, null, 2)}`)

    const result: SingleTurnResult = {
      doneToolCalled: false,
      requiresHumanInput: false
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
    if (!llm.bindTools || typeof llm.bindTools !== 'function') {
      throw new Error('This LLM does not support tool binding');
    }

    const message_history = this.messageManager.getMessages();

    const llmWithTools = llm.bindTools(this.toolManager.getAll());
    const stream = await llmWithTools.stream(message_history, {
      signal: this.executionContext.abortController.signal
    });
    
    let accumulatedChunk: AIMessageChunk | undefined;
    let accumulatedText = '';
    let hasStartedThinking = false;
    let currentMsgId: string | null = null;

    for await (const chunk of stream) {
      this.checkIfAborted();  // Manual check during streaming

      if (chunk.content && typeof chunk.content === 'string') {
        // Start thinking on first real content
        if (!hasStartedThinking) {
          // Start thinking - handled via streaming
          hasStartedThinking = true;
          // Create message ID on first content chunk
          currentMsgId = PubSub.generateId('msg_assistant');
        }
        
        // Stream thought chunk - will be handled via assistant message streaming
        accumulatedText += chunk.content;
        
        // Publish/update the message with accumulated content in real-time
        if (currentMsgId) {
          this.pubsub.publishMessage(PubSub.createMessageWithId(currentMsgId, accumulatedText, 'thinking'));
        }
      }
      accumulatedChunk = !accumulatedChunk ? chunk : accumulatedChunk.concat(chunk);
    }
    
    // Only finish thinking if we started and have content
    if (hasStartedThinking && accumulatedText.trim() && currentMsgId) {
      // Final publish with complete message (in case last chunk was missed)
      this.pubsub.publishMessage(PubSub.createMessageWithId(currentMsgId, accumulatedText, 'thinking'));
    }
    
    if (!accumulatedChunk) return new AIMessage({ content: '' });
    
    // Convert the final chunk back to a standard AIMessage
    return new AIMessage({
      content: accumulatedChunk.content,
      tool_calls: accumulatedChunk.tool_calls,
    });
  }

  private async _processToolCalls(toolCalls: any[]): Promise<SingleTurnResult> {
    const result: SingleTurnResult = {
      doneToolCalled: false,
      requiresHumanInput: false
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
      if (toolName === 'refresh_browser_state_tool' && parsedResult.ok) {
        const simplifiedResult = JSON.stringify({ 
          ok: true, 
          output: "Emergency browser state refresh completed - full DOM analysis available" 
        });
        this.messageManager.addTool(simplifiedResult, toolCallId);
        this.messageManager.addBrowserState(parsedResult.output);
      } else {
        this.messageManager.addTool(toolResult, toolCallId);
      }

      if (toolName === 'done_tool' && parsedResult.ok) {
        result.doneToolCalled = true;
      }
      
      if (toolName === 'human_input_tool' && parsedResult.ok && parsedResult.requiresHumanInput) {
        result.requiresHumanInput = true;
        // Break from the loop immediately to handle human input
        break;
      }
    }
    
    return result;
  }


  private async _validateTaskCompletion(task: string): Promise<{
    isComplete: boolean;
    reasoning: string;
    suggestions: string[];
  }> {
    const validatorTool = this.toolManager.get('validator_tool');
    if (!validatorTool) {
      return {
        isComplete: false,
        reasoning: 'Validation skipped - tool not available',
        suggestions: []
      };
    }

    const args = { task };
    try {
      // Tool start for validator - not needed
      const result = await validatorTool.func(args);
      const parsedResult = jsonParseToolOutput(result);
      
      // Publish validator result
      if (parsedResult.ok) {
        const validationData = parsedResult.output;
        const status = validationData.isComplete ? 'Complete' : 'Incomplete';
        this.pubsub.publishMessage(PubSub.createMessage(`Task validation: ${status}`, 'thinking'));
      }
      
      if (parsedResult.ok) {
        // Use the validation data from output
        const validationData = parsedResult.output;
        return {
          isComplete: validationData.isComplete,
          reasoning: validationData.reasoning,
          suggestions: validationData.suggestions || []
        };
      }
    } catch (error) {
      // Publish validator error
      this.pubsub.publishMessage(PubSub.createMessage('Error in validator_tool: Validation failed', 'error'));
    }
    
    return {
      isComplete: false,
      reasoning: 'Validation failed - continuing execution',
      suggestions: []
    };
  }

  /**
   * Generate and emit task result using ResultTool
   */
  private async _generateTaskResult(task: string): Promise<void> {
    const resultTool = this.toolManager.get('result_tool');
    if (!resultTool) {
      return;
    }

    try {
      const args = { task };
      const result = await resultTool.func(args);
      const parsedResult = jsonParseToolOutput(result);
      
      if (parsedResult.ok && parsedResult.output) {
        const { message } = parsedResult.output;
        this.pubsub.publishMessage(PubSub.createMessage(message, 'assistant'));
      } else {
        // Fallback on error
        this.pubsub.publishMessage(PubSub.createMessage('Task completed.', 'assistant'));
      }
    } catch (error) {
      // Fallback on error
      this.pubsub.publishMessage(PubSub.createMessage('Task completed.', 'assistant'));
    }
  }

  /**
   * Handle execution errors - tools have already published specific errors
   */
  private _handleExecutionError(error: unknown, task: string): void {
    // Check if this is a user cancellation - handle silently
    const isUserCancellation = error instanceof AbortError || 
                               this.executionContext.isUserCancellation() || 
                               (error instanceof Error && error.name === "AbortError");
    
    if (isUserCancellation) {
      // Don't publish message here - already handled in _subscribeToExecutionStatus
      // when the cancelled status event is received
    } else {
      // Log error metric with details
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.name : 'UnknownError';
      
      Logging.logMetric('execution_error', {
        error: errorMessage,
        error_type: errorType,
        task: task.substring(0, 200), // Truncate long tasks
        mode: 'browse',
        agent: 'BrowserAgent'
      });
      
      console.error('Execution error (already reported by tool):', error);
      throw error;
    }
  }

  /**
   * Detect if the agent is stuck in a loop by checking for repeated messages
   * @param lookback - Number of recent messages to check (default: 8)
   * @param threshold - Number of times a message must appear to be considered a loop (default: 4)
   * @returns true if a loop is detected
   */
  private _detectLoop(lookback: number = 8, threshold: number = 4): boolean {
    const messages = this.messageManager.getMessages();
    
    // Need at least lookback messages to check
    if (messages.length < lookback) {
      return false;
    }
    
    // Get the last N messages, filtering only AI/assistant messages
    const recentMessages = messages
      .slice(-lookback)
      .filter(msg => msg._getType() === 'ai')
      .map(msg => {
        // Normalize the content for comparison
        const content = typeof msg.content === 'string' ? msg.content : '';
        return content.trim().toLowerCase();
      });

    // Count occurrences of each message
    const messageCount = new Map<string, number>();
    for (const msg of recentMessages) {
      if (msg) {  // Skip empty messages
        const count = messageCount.get(msg) || 0;
        messageCount.set(msg, count + 1);
        
        // If any message appears threshold times or more, we have a loop
        if (count + 1 >= threshold) {
          console.warn(`Loop detected: Message "${msg.substring(0, 50)}..." repeated ${count + 1} times`);
          return true;
        }
      }
    }

    return false;
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
        if (Date.now() - startTime > POCAgent.HUMAN_INPUT_TIMEOUT) {
          this.pubsub.publishMessage(
            PubSub.createMessage('⏱️ Human input timed out after 10 minutes', 'error')
          );
          return 'timeout';
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, POCAgent.HUMAN_INPUT_CHECK_INTERVAL));
      }
      
      // Aborted externally
      return 'abort';
      
    } finally {
      // Clean up subscription
      subscription.unsubscribe();
    }
  }
}
