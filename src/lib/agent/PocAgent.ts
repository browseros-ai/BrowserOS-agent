/**
 * PocAgent - Simplified browser automation agent
 * 
 * This is a minimal implementation that delegates all orchestration logic to the LLM.
 * The agent simply provides tools and lets the LLM decide when to plan, execute, and validate.
 * 
 * ## Core Design Principles
 * - Single execution loop
 * - No hardcoded strategies
 * - LLM decides when to use planner_tool, validator_tool, etc.
 * - Minimal special handling (only glow animations and refresh_state)
 * 
 * ## Execution Flow
 * 1. Register tools
 * 2. Set system prompt
 * 3. Loop: Instruct LLM → Execute tools → Check if done
 * 4. Exit when done_tool is called
 */

import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManager } from '@/lib/runtime/MessageManager';
import { ToolManager } from '@/lib/tools/ToolManager';
import { createPlannerTool } from '@/lib/tools/planning/PlannerTool';
import { createTodoManagerTool } from '@/lib/tools/planning/TodoManagerTool';
import { createDoneTool } from '@/lib/tools/utils/DoneTool';
import { createNavigationTool } from '@/lib/tools/navigation/NavigationTool';
import { createFindElementTool } from '@/lib/tools/navigation/FindElementTool';
import { createInteractionTool } from '@/lib/tools/navigation/InteractionTool';
import { createScrollTool } from '@/lib/tools/navigation/ScrollTool';
import { createSearchTool } from '@/lib/tools/navigation/SearchTool';
import { createRefreshStateTool } from '@/lib/tools/navigation/RefreshStateTool';
import { createTabOperationsTool } from '@/lib/tools/tab/TabOperationsTool';
import { createGroupTabsTool } from '@/lib/tools/tab/GroupTabsTool';
import { createGetSelectedTabsTool } from '@/lib/tools/tab/GetSelectedTabsTool';
import { createValidatorTool } from '@/lib/tools/validation/ValidatorTool';
import { createScreenshotTool } from '@/lib/tools/utils/ScreenshotTool';
import { createExtractTool } from '@/lib/tools/extraction/ExtractTool';
import { createResultTool } from '@/lib/tools/result/ResultTool';
import { createSubAgentTool } from '@/lib/tools/agent/SubAgentTool';
import { generateSystemPrompt } from './PocAgent.prompt';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { EventProcessor } from '@/lib/events/EventProcessor';
import { Abortable, AbortError } from '@/lib/utils/Abortable';
import { formatToolOutput } from '@/lib/tools/formatToolOutput';
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';
import { formatTodoList } from '@/lib/tools/utils/formatTodoList';
import { Logging } from '@/lib/utils/Logging';

// Constants for execution control
const MAX_ITERATIONS = 50;  // Maximum iterations before giving up

export class PocAgent {

  // Tools that trigger glow animation when executed
  private static readonly GLOW_ENABLED_TOOLS = new Set([
    'navigation_tool',
    'find_element_tool',
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

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.toolManager = new ToolManager(executionContext);
    this.glowService = GlowAnimationService.getInstance();
    this._registerTools();
  }

  // Getters to access context components
  private get messageManager(): MessageManager {
    return this.executionContext.messageManager;
  }

  private get eventEmitter(): EventProcessor {
    return this.executionContext.getEventProcessor();
  }

  private get todoStore() {
    return this.executionContext.todoStore;
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

  private _registerTools(): void {
    // Register all tools first
    this.toolManager.register(createPlannerTool(this.executionContext));
    this.toolManager.register(createTodoManagerTool(this.executionContext));
    this.toolManager.register(createDoneTool());

    // Navigation tools
    this.toolManager.register(createNavigationTool(this.executionContext));
    this.toolManager.register(createFindElementTool(this.executionContext));
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

    // util tools
    this.toolManager.register(createScreenshotTool(this.executionContext));
    this.toolManager.register(createExtractTool(this.executionContext));

    // Result tool
    this.toolManager.register(createResultTool(this.executionContext));

    // SubAgent tool for delegating complex tasks
    // this.toolManager.register(createSubAgentTool(this.executionContext));

    // No need for classification tool in simplified version
  }


  /**
   * Main entry point - simplified execution loop
   */
  async execute(task: string): Promise<void> {
    let taskCompleted = false;
    try {
      Logging.log('PocAgent', `Executing task: ${task}`, 'info');
      
      // 1. SETUP: Initialize system prompt and user task
      this._initializeExecution(task);
      this.eventEmitter.info('Starting task execution...');

      // 2. EXECUTE: Simple loop until done or max iterations
      let stepCount = 0;
      while (stepCount < MAX_ITERATIONS) {
        this.checkIfAborted();  // Check if user cancelled
        Logging.log('PocAgent', `Executing step ${stepCount} of ${MAX_ITERATIONS}`, 'info');
        Logging.log('PocAgent', `Token usage: ${this.executionContext.messageManager.getTokenCount()}, remaining: ${this.executionContext.messageManager.remaining()}`, 'info');
        

        let instruction = '';
        if (stepCount === 0) {
          instruction = `Analyze the task and begin execution. For complex tasks, use planner_tool to create a plan. For simple tasks, execute directly. Call done_tool when the task is complete.`;
        }

        // Execute one turn with the LLM
        const { wasDoneCalled: wasDoneToolCalled, wasValidatorCalled: wasValidatorToolCalled } = await this._executeSingleTurn(instruction);

        // if we called done_tool and did not call validator_tool, we need to validate the task manually
        if (wasDoneToolCalled && !wasValidatorToolCalled) {
          const { isComplete, reasoning, suggestions } = await this._validateTaskCompletion(task);
          if (isComplete) {
            taskCompleted = true;
            break;
          }

          if (!isComplete) {
            if (suggestions.length > 0) {
              const validationMessage = `Validation result: ${reasoning}\nSuggestions: ${suggestions.join(', ')}`;
              this.messageManager.addAI(validationMessage);
              taskCompleted = false;
            }
            else {
              this.messageManager.addAI(`Validation failed. Re-plan and execute.`);
            }
          }
        }
        
        // maybe add system reminders
        await this._maybeAddSystemReminders(stepCount);
        
        // increment step count
        stepCount++;
      }
      
      // if task is completed, generate the result and exit
      if (taskCompleted) {
        // 3. COMPLETE: Generate final result and exit
        await this._generateTaskResult(task);
        return;
      }
      
      
      // if task is not completed, throw an error
      if (stepCount >= MAX_ITERATIONS) {
        throw new Error(`Task failed to complete within ${MAX_ITERATIONS} iterations`);
      }
      else {
        throw new Error(`Task couldn't be completed 😢`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if this is a user cancellation
      const isUserCancellation = error instanceof AbortError ||
        this.executionContext.isUserCancellation() ||
        (error instanceof Error && error.name === "AbortError");

      if (!isUserCancellation) {
        this.eventEmitter.error(`Couldn't complete the task because "${errorMessage}"`, true);  // Mark as fatal error
      }

      throw error;
    } finally {
      // Ensure glow animation is stopped at the end of execution
      try {
        // Get all active glow tabs from the service
        const activeGlows = await this.glowService.getAllActiveGlows();
        for (const tabId of activeGlows) {
          await this.glowService.stopGlow(tabId);
        }
      } catch (error) {
        this.eventEmitter.debug(`Could not stop glow animation: ${error}`);
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
    this.messageManager.addHuman(`Complete this task: "${task}"`);
  }

  private async _maybeAddSystemReminders(stepCount: number): Promise<void> {
    const suffixMessage = `\n\nThese are ONLY for your reference. NEVER echo them in your responses.`;

    if (stepCount % 5 === 0 && stepCount > 0) {
      this.messageManager.addSystemReminder(
        `REMINDER: Use validator_tool check the progress of the task and re-plan using planner_tool.${suffixMessage}`
      );
    }
    if (this._getRandom(0.2)) {
      this.messageManager.addSystemReminder(
        `REMINDER: You can use screenshot_tool for visual reference of the page if you need more clarity.${suffixMessage}`
      );
    }
    
    if (this._getRandom(0.3)) {
      this.messageManager.addSystemReminder(
        `REMINDER: Ensure you are updating your todo_manager_tool frequently to track your progress and updating them as you complete steps.${suffixMessage}`
      );
    }
  }

  private _getRandom(probability: number): boolean {
    return Math.random() < probability;
  }



  // ===================================================================
  //  Core Execution Logic
  // ===================================================================
  /**
   * Executes a single "turn" with the LLM, including streaming and tool processing.
   * @returns {Promise<{wasDoneCalled: boolean, wasValidatorCalled: boolean}>} - True if the `done_tool` was successfully called.
   */
  @Abortable
  private async _executeSingleTurn(instruction?: string): Promise<{ wasDoneCalled: boolean, wasValidatorCalled: boolean }> {
    if (instruction && instruction.length > 0) {
      this.messageManager.addHuman(instruction);
    }

    // This method encapsulates the streaming logic
    const llmResponse = await this._invokeLLMWithStreaming();

    let wasDoneCalled = false;
    let wasValidatorCalled = false;

    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      // IMPORTANT: We must add the full AIMessage object (not just a string) to maintain proper conversation history.
      // The AIMessage contains both content and tool_calls. LLMs like Google's API validate that function calls
      // in the conversation history match with their corresponding ToolMessage responses. If we only add a string
      // here, we lose the tool_calls information, causing "function calls don't match" errors.
      this.messageManager.add(llmResponse);

      const { wasDoneCalled: wasDoneCalled_inner, wasValidatorCalled: wasValidatorCalled_inner } = await this._processToolCalls(llmResponse.tool_calls);

      wasDoneCalled = wasDoneCalled_inner;
      wasValidatorCalled = wasValidatorCalled_inner;

    } else if (llmResponse.content) {
      // If the AI responds with text, just add it to the history
      this.messageManager.addAI(llmResponse.content as string);
    }

    return { wasDoneCalled, wasValidatorCalled };
  }

  @Abortable  // Checks at method start
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

    for await (const chunk of stream) {
      this.checkIfAborted();  // Manual check during streaming

      if (chunk.content && typeof chunk.content === 'string') {
        // Start thinking on first real content
        if (!hasStartedThinking) {
          this.eventEmitter.startThinking();
          hasStartedThinking = true;
        }

        this.eventEmitter.streamThoughtDuringThinking(chunk.content);
        accumulatedText += chunk.content;
      }
      accumulatedChunk = !accumulatedChunk ? chunk : accumulatedChunk.concat(chunk);
    }

    // Only finish thinking if we started and have content
    if (hasStartedThinking && accumulatedText.trim()) {
      this.eventEmitter.finishThinking(accumulatedText);
    }

    if (!accumulatedChunk) return new AIMessage({ content: '' });

    // Convert the final chunk back to a standard AIMessage
    return new AIMessage({
      content: accumulatedChunk.content,
      tool_calls: accumulatedChunk.tool_calls,
    });
  }

  @Abortable  // Checks at method start
  private async _processToolCalls(toolCalls: any[]): Promise<{ wasDoneCalled: boolean, wasValidatorCalled: boolean }> {
    let wasDoneCalled = false;
    let wasValidatorCalled = false;

    for (const toolCall of toolCalls) {
      this.checkIfAborted();  // Manual check before each tool

      const { name: toolName, args, id: toolCallId } = toolCall;
      const tool = this.toolManager.get(toolName);

      if (!tool) {
        // Handle tool not found
        continue;
      }

      // Handle glow animation for applicable tools
      // This enables glow only for certain interactive tools.
      // we'll disable at the end of agent execution
      await this._maybeStartGlowAnimation(toolName);

      this.eventEmitter.toolStart(toolName, args);
      const result = await tool.func(args);
      const parsedResult = JSON.parse(result);

      // Format the tool output for display
      const displayMessage = formatToolOutput(toolName, parsedResult);
      this.eventEmitter.debug('Executing tool: ' + toolName + ' result: ' + displayMessage);

      // Emit tool result for UI display (skip certain tools)
      // Skip result_tool to avoid duplicating the final summary in the UI
      if (toolName !== 'result_tool') {
        this.eventEmitter.emitToolResult(toolName, result);
      }

      // Add the result back to the message history for context
      // add toolMessage before systemReminders as openAI expects each 
      // tool call to be followed by toolMessage
      this.messageManager.addTool(result, toolCallId);

      // Special handling for refresh_browser_state tool
      // if (toolName === 'refresh_browser_state_tool' && parsedResult.ok) {
      // }

      // Special handling for todo_manager tool
      if (toolName === 'todo_manager_tool' && parsedResult.ok && args.action !== 'list') {
        this.messageManager.addSystemReminder(
          `TODO list updated. Current state:\n${this.todoStore.getXml()}`
        );
        this.eventEmitter.info(formatTodoList(this.todoStore.getJson()));
      }

      if (toolName === 'done_tool' && parsedResult.ok) {
        wasDoneCalled = true;
      }

      if (toolName === 'validator_tool' && parsedResult.ok) {
        wasValidatorCalled = true;
      }
    }

    return { wasDoneCalled, wasValidatorCalled };
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
      const parsedResult = JSON.parse(result);

      if (parsedResult.ok && parsedResult.output) {
        const { success, message } = parsedResult.output;
        this.eventEmitter.emitTaskResult(success, message);
      } else {
        // Fallback on error
        this.eventEmitter.emitTaskResult(true, 'Task completed.');
      }
    } catch (error) {
      // Fallback on error
      this.eventEmitter.emitTaskResult(true, 'Task completed.');
    }
  }

  private async _validateTaskCompletion(task: string): Promise<{
    isComplete: boolean;
    reasoning: string;
    suggestions: string[];
  }> {
    const validatorTool = this.toolManager.get('validator_tool');
    if (!validatorTool) {
      return {
        isComplete: true,
        reasoning: 'Validation skipped - tool not available',
        suggestions: []
      };
    }

    const args = { task };
    try {
      this.eventEmitter.toolStart('validator_tool', args);
      const result = await validatorTool.func(args);
      const parsedResult = JSON.parse(result);

      // Format the validator output
      const validator_formatted_output = formatToolOutput('validator_tool', parsedResult);
      this.eventEmitter.toolEnd('validator_tool', parsedResult.ok, validator_formatted_output);

      if (parsedResult.ok) {
        // Parse the validation data from output
        const validationData = JSON.parse(parsedResult.output);
        return {
          isComplete: validationData.isComplete,
          reasoning: validationData.reasoning,
          suggestions: validationData.suggestions || []
        };
      }
    } catch (error) {
      const errorResult = { ok: false, error: 'Validation failed' };
      const error_formatted_output = formatToolOutput('validator_tool', errorResult);
      this.eventEmitter.toolEnd('validator_tool', false, error_formatted_output);
    }

    return {
      isComplete: true,
      reasoning: 'Validation failed - continuing execution',
      suggestions: []
    };
  }


  /**
   * Handle glow animation for tools that interact with the browser
   * @param toolName - Name of the tool being executed
   */
  private async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    // Check if this tool should trigger glow animation
    if (!PocAgent.GLOW_ENABLED_TOOLS.has(toolName)) {
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
      this.eventEmitter.debug(`Could not manage glow for tool ${toolName}: ${error}`);
      return false;
    }
  }
}
