/**
 * BrowserAgent - Unified agent that handles all browser automation tasks
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
import { createPlannerTool } from '@/lib/tools/planning/PlannerTool';
import { createTodoManagerTool } from '@/lib/tools/planning/TodoManagerTool';
import { createDoneTool } from '@/lib/tools/utils/DoneTool';
import { createNavigationTool } from '@/lib/tools/navigation/NavigationTool';
import { createInteractionTool } from '@/lib/tools/navigation/InteractionTool';
import { createScrollTool } from '@/lib/tools/navigation/ScrollTool';
import { createSearchTool } from '@/lib/tools/navigation/SearchTool';
import { createRefreshStateTool } from '@/lib/tools/navigation/RefreshStateTool';
import { createTabOperationsTool } from '@/lib/tools/tab/TabOperationsTool';
import { createGroupTabsTool } from '@/lib/tools/tab/GroupTabsTool';
import { createGetSelectedTabsTool } from '@/lib/tools/tab/GetSelectedTabsTool';
import { createClassificationTool } from '@/lib/tools/classification/ClassificationTool';
import { createValidatorTool } from '@/lib/tools/validation/ValidatorTool';
import { createScreenshotTool } from '@/lib/tools/utils/ScreenshotTool';
import { createExtractTool } from '@/lib/tools/extraction/ExtractTool';
import { createResultTool } from '@/lib/tools/result/ResultTool';
import { generateSystemPrompt, generateSingleTurnExecutionPrompt } from './BrowserAgent.prompt';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { EventProcessor } from '@/lib/events/EventProcessor';
import { PLANNING_CONFIG } from '@/lib/tools/planning/PlannerTool.config';
import { AbortError } from '@/lib/utils/Abortable';
import { formatToolOutput } from '@/lib/tools/formatToolOutput';
import { formatTodoList } from '@/lib/tools/utils/formatTodoList';
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';

// Type Definitions
interface Plan {
  steps: PlanStep[];
}

interface PlanStep {
  action: string;
  reasoning: string;
}

interface ClassificationResult {
  is_simple_task: boolean;
  is_followup_task: boolean;
}

export class BrowserAgent {
  // Constants for explicit control
  private static readonly MAX_STEPS_FOR_SIMPLE_TASKS = 10;
  private static readonly MAX_STEPS_FOR_COMPLEX_TASKS = PLANNING_CONFIG.STEPS_PER_PLAN;

  // Outer loop is -- plan -> execute -> validate
  private static readonly MAX_STEPS_OUTER_LOOP = 100;

  // Inner loop is -- execute TODOs, one after the other.
  private static readonly MAX_STEPS_INNER_LOOP  = 30; 

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
   * Main entry point.
   * Orchestrates classification and delegates to the appropriate execution strategy.
   */
  async execute(task: string): Promise<void> {
    try {
      // 1. SETUP: Initialize system prompt and user task
      this._initializeExecution(task);

      // 2. CLASSIFY: Determine the task type
      const classification = await this._classifyTask(task);
      
      // Clear message history if this is not a follow-up task
      if (!classification.is_followup_task) {
        this.messageManager.clear();
        // Re-add system prompt and user task after clearing
        this._initializeExecution(task);
      }
      
      let message: string;
      if (classification.is_followup_task) {
        message = 'Following up on the previous task...';
      } else if (classification.is_simple_task) {
        message = 'Executing the task...';
      } else {
        message = 'Creating a step-by-step plan to complete the task';
      }
      // Tag startup status messages for UI styling
      this.eventEmitter.info(message, 'startup');

      // 3. DELEGATE: Route to the correct execution strategy
      if (classification.is_simple_task) {
        await this._executeSimpleTaskStrategy(task);
      } else {
        await this._executeMultiStepStrategy(task);
      }

      // 4. FINALISE: Generate final result
      await this._generateTaskResult(task);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is a user cancellation
      const isUserCancellation = error instanceof AbortError || 
                                 this.executionContext.isUserCancellation() || 
                                 (error instanceof Error && error.name === "AbortError");
      
      if (!isUserCancellation) {
        this.eventEmitter.error(`Oops! Got a fatal error when executing task: ${errorMessage}`, true);  // Mark as fatal error
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
    this.messageManager.addHuman(task);
  }

  private _registerTools(): void {
    // Register all tools first
    this.toolManager.register(createPlannerTool(this.executionContext));
    this.toolManager.register(createTodoManagerTool(this.executionContext));
    this.toolManager.register(createDoneTool());
    
    // Navigation tools
    this.toolManager.register(createNavigationTool(this.executionContext));
    // Note: FindElementTool is no longer registered - InteractionTool now handles finding and interacting
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
    
    // Register classification tool last with all tool descriptions
    const toolDescriptions = this.toolManager.getDescriptions();
    this.toolManager.register(createClassificationTool(this.executionContext, toolDescriptions));
  }

  private async _classifyTask(task: string): Promise<ClassificationResult> {
    this.eventEmitter.info('Analyzing task complexity...');
    
    const classificationTool = this.toolManager.get('classification_tool');
    if (!classificationTool) {
      // Default to complex task if classification tool not found
      return { is_simple_task: false, is_followup_task: false };
    }

    const args = { task };
    
    try {
      this.eventEmitter.toolStart('classification_tool', args);
      const result = await classificationTool.func(args);
      const parsedResult = JSON.parse(result);
      
      if (parsedResult.ok) {
        const classification = JSON.parse(parsedResult.output);
        const classification_formatted_output = formatToolOutput('classification_tool', parsedResult);
        this.eventEmitter.toolEnd('classification_tool', true, classification_formatted_output);
        return { 
          is_simple_task: classification.is_simple_task,
          is_followup_task: classification.is_followup_task 
        };
      }
    } catch (error) {
      const errorResult = { ok: false, error: 'Classification failed' };
      const error_formatted_output = formatToolOutput('classification_tool', errorResult);
      this.eventEmitter.toolEnd('classification_tool', false, error_formatted_output);
    }
    
    // Default to complex task on any failure
    return { is_simple_task: false, is_followup_task: false };
  }

  // ===================================================================
  //  Execution Strategy 1: Simple Tasks (No Planning)
  // ===================================================================
  private async _executeSimpleTaskStrategy(task: string): Promise<void> {
    this.eventEmitter.debug(`Executing as a simple task. Max attempts: ${BrowserAgent.MAX_STEPS_FOR_SIMPLE_TASKS}`);

    for (let attempt = 1; attempt <= BrowserAgent.MAX_STEPS_FOR_SIMPLE_TASKS; attempt++) {
      this.checkIfAborted();  // Manual check in loop

      this.eventEmitter.debug(`Attempt ${attempt}/${BrowserAgent.MAX_STEPS_FOR_SIMPLE_TASKS}: Executing task...`);

      const instruction = `The user's goal is: "${task}". Please take the next best action to complete this goal and call the 'done_tool' when finished.`;
      const isTaskCompleted = await this._executeSingleTurn(instruction);

      if (isTaskCompleted) {
        return;  // SUCCESS - task result will be generated in execute()
      }      
    }

    throw new Error(`Task failed to complete after ${BrowserAgent.MAX_STEPS_FOR_SIMPLE_TASKS} attempts.`);
  }

  // ===================================================================
  //  Execution Strategy 2: Multi-Step Tasks (Plan -> Execute -> Repeat)
  // ===================================================================
  private async _executeMultiStepStrategy(task: string): Promise<void> {
    this.eventEmitter.debug('Executing as a complex multi-step task');
    let outer_loop_index = 0;

    while (outer_loop_index < BrowserAgent.MAX_STEPS_OUTER_LOOP) {
      this.checkIfAborted();

      // 1. PLAN: Create a new plan
      const plan = await this._createMultiStepPlan(task);
      if (plan.steps.length === 0) {
        throw new Error('Planning failed. Could not generate next steps.');
      }
      this.eventEmitter.debug('Plan created:', JSON.stringify(plan, null, 2));

      // 2. Convert plan to TODOs
      await this._updateTodosFromPlan(plan);

      // Show TODO list after plan creation
      const todoStore = this.executionContext.todoStore;
      this.eventEmitter.info(formatTodoList(todoStore.getJson()));

      // 3. EXECUTE: Inner loop with one TODO per turn
      let inner_loop_index = 0;
      
      while (inner_loop_index < BrowserAgent.MAX_STEPS_INNER_LOOP && !todoStore.isAllDoneOrSkipped()) {
        this.checkIfAborted();
        
        // Use the generateTodoExecutionPrompt for TODO execution
        const instruction = generateSingleTurnExecutionPrompt(task);
        
        const isTaskCompleted = await this._executeSingleTurn(instruction);
        inner_loop_index++;
        
        if (isTaskCompleted) {
          break; // done_tool was called
        }
      }

      // 4. VALIDATE: Check if we should continue or re-plan
      const validationResult = await this._validateTaskCompletion(task);
      if (validationResult.isComplete) {
        return;
      }

      // Add validation feedback for next planning cycle
      if (validationResult.suggestions.length > 0) {
        const validationMessage = `Validation result: ${validationResult.reasoning}\nSuggestions: ${validationResult.suggestions.join(', ')}`;
        this.messageManager.addAI(validationMessage);
      }

      outer_loop_index++;
    }

    throw new Error(`Task did not complete within ${BrowserAgent.MAX_STEPS_OUTER_LOOP} planning cycles.`);
  }

  // ===================================================================
  //  Shared Core & Helper Logic
  // ===================================================================
  /**
   * Executes a single "turn" with the LLM, including streaming and tool processing.
   * @returns {Promise<boolean>} - True if the `done_tool` was successfully called.
   */
  private async _executeSingleTurn(instruction: string): Promise<boolean> {
    this.messageManager.addHuman(instruction);
    
    // This method encapsulates the streaming logic
    const llmResponse = await this._invokeLLMWithStreaming();
    // console.log("LLM Response:", JSON.stringify(llmResponse, null, 4));
    

    let wasDoneToolCalled = false;
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      // IMPORTANT: We must add the full AIMessage object (not just a string) to maintain proper conversation history.
      // The AIMessage contains both content and tool_calls. LLMs like Google's API validate that function calls
      // in the conversation history match with their corresponding ToolMessage responses. If we only add a string
      // here, we lose the tool_calls information, causing "function calls don't match" errors.
      this.messageManager.add(llmResponse);
      wasDoneToolCalled = await this._processToolCalls(llmResponse.tool_calls);
      
    } else if (llmResponse.content) {
      // If the AI responds with text, just add it to the history
      this.messageManager.addAI(llmResponse.content as string);
    }

    return wasDoneToolCalled;
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

  private async _processToolCalls(toolCalls: any[]): Promise<boolean> {
    let wasDoneToolCalled = false;
    
    for (const toolCall of toolCalls) {
      // Check abort before processing each tool
      this.checkIfAborted();

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
      
      // Check abort after tool execution completes
      this.checkIfAborted();
      
      const parsedResult = JSON.parse(result);
      
      // Format the tool output for display
      const displayMessage = formatToolOutput(toolName, parsedResult);
      this.eventEmitter.debug('Executing tool: ' + toolName + ' result: ' + displayMessage);
      
      // Emit tool result for UI display
      // Skip emitting refresh_browser_state_tool to prevent browser state from appearing in UI
      // Also skip result_tool to avoid duplicating the final summary in the UI
      if (toolName !== 'refresh_browser_state_tool' && toolName !== 'result_tool') {
        this.eventEmitter.emitToolResult(toolName, result);
      }

      // Add the result back to the message history for context
      // Special handling for refresh_browser_state_tool vs other tools:
      // - refresh_browser_state_tool: Add simplified tool message AND browser state context
      // - All other tools: Add as regular tool message for proper conversation flow
      if (toolName === 'refresh_browser_state_tool' && parsedResult.ok) {
        // Add proper tool result message with toolCallId for message history continuity
        const simplifiedResult = JSON.stringify({ ok: true, output: "Browser state refreshed successfully" });
        this.messageManager.addTool(simplifiedResult, toolCallId);
        // Also update the browser state context for the agent to use
        this.messageManager.addBrowserState(parsedResult.output);
      } else {
        this.messageManager.addTool(result, toolCallId);
      }

      // Special handling for todo_manager_tool, add system reminder for mutations
      if (toolName === 'todo_manager_tool' && parsedResult.ok && args.action !== 'list') {
        const todoStore = this.executionContext.todoStore;
        this.messageManager.addSystemReminder(
          `TODO list updated. Current state:\n${todoStore.getXml()}`
        );
        // Show updated TODO list to user
        this.eventEmitter.info(formatTodoList(todoStore.getJson()));
      }


      if (toolName === 'done_tool' && parsedResult.ok) {
        wasDoneToolCalled = true;
      }
    }
    
    return wasDoneToolCalled;
  }

  private async _createMultiStepPlan(task: string): Promise<Plan> {
    const plannerTool = this.toolManager.get('planner_tool')!;
    const args = {
      task: `Based on the history, continue with the main goal: ${task}`,
      max_steps: BrowserAgent.MAX_STEPS_FOR_COMPLEX_TASKS
    };

    this.eventEmitter.toolStart('planner_tool', args);
    const result = await plannerTool.func(args);
    const parsedResult = JSON.parse(result);
    
    // Format the planner output
    const planner_formatted_output = formatToolOutput('planner_tool', parsedResult);
    this.eventEmitter.toolEnd('planner_tool', parsedResult.ok, planner_formatted_output);

    if (parsedResult.ok && parsedResult.output?.steps) {
      return { steps: parsedResult.output.steps };
    }
    return { steps: [] };  // Return an empty plan on failure
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


  /**
   * Update TODOs from plan steps (replaces all existing TODOs)
   */
  private async _updateTodosFromPlan(plan: Plan): Promise<void> {
    const todoTool = this.toolManager.get('todo_manager_tool');
    if (!todoTool || plan.steps.length === 0) return;
    
    // Replace all TODOs with the new plan
    const todos = plan.steps.map(step => ({ content: step.action }));
    const args = { action: 'replace_all' as const, todos };
    await todoTool.func(args);
  }

  /**
   * Handle glow animation for tools that interact with the browser
   * @param toolName - Name of the tool being executed
   */
  private async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    // Check if this tool should trigger glow animation
    if (!BrowserAgent.GLOW_ENABLED_TOOLS.has(toolName)) {
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
