import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManager, MessageManagerReadOnly } from '@/lib/runtime/MessageManager';
import { ToolManager } from '@/lib/tools/ToolManager';
import { TodoStore } from '@/lib/runtime/TodoStore';
import { EventProcessor } from '@/lib/events/EventProcessor';
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { Abortable, AbortError } from '@/lib/utils/Abortable';
import { formatToolOutput } from '@/lib/tools/formatToolOutput';
import { formatTodoList } from '@/lib/tools/utils/formatTodoList';
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
import { createValidatorTool } from '@/lib/tools/validation/ValidatorTool';
import { createScreenshotTool } from '@/lib/tools/utils/ScreenshotTool';
import { createExtractTool } from '@/lib/tools/extraction/ExtractTool';
import { generateSubAgentSystemPrompt, generateSubAgentTaskPrompt } from './SubAgent.prompt';
import { z } from 'zod';
import { invokeWithRetry } from '@/lib/utils/retryable';

// Schema for summary generation
const SubAgentSummarySchema = z.object({
  success: z.boolean(),  // true if task completed, false if failed
  summary: z.string()  // Brief summary of what was accomplished
});

/**
 * SubAgent - A self-contained agent that can execute multi-step tasks
 * Used by SubAgentTool to handle complex task execution in isolation
 */
export class SubAgent {
  private static readonly MAX_STEPS = 20;  // Max total execution steps
  
  private readonly parentContext: ExecutionContext;
  private readonly executionContext: ExecutionContext;
  private readonly messageManager: MessageManager;
  private readonly toolManager: ToolManager;
  private readonly todoStore: TodoStore;
  private readonly eventEmitter: EventProcessor;
  private readonly task: string;
  private readonly description: string;

  constructor(
    parentContext: ExecutionContext,
    task: string,
    description: string
  ) {
    this.parentContext = parentContext;
    this.task = task;
    this.description = description;
    
    // Create isolated components
    this.messageManager = new MessageManager(128000);
    this.todoStore = new TodoStore();
    
    // Create a new ExecutionContext for the subagent
    // Keep parent's browser context and event processors
    // But use our own message manager and todo store
    // ExecutionContext will create its own abort controller internally
    this.executionContext = new ExecutionContext({
      browserContext: parentContext.browserContext,
      messageManager: this.messageManager,
      debugMode: parentContext.debugMode,
      eventBus: parentContext.getEventBus(),
      eventProcessor: parentContext.getEventProcessor(),
      todoStore: this.todoStore
    });
    
    // Share parent's abort controller so cancellation propagates
    this.executionContext.abortController = parentContext.abortController;
    
    // Create tool manager with our execution context
    this.toolManager = new ToolManager(this.executionContext);
    
    // Use parent's event emitter for UI updates
    this.eventEmitter = parentContext.getEventProcessor();
    
    // Register tools
    this._registerTools();
  }

  /**
   * Execute the task using plan-execute-validate cycles
   */
  async execute(): Promise<{ success: boolean; summary: string; error?: string }> {
    try {
      // Initialize with system prompt and task
      this._initializeExecution();
      
      // Execute simple loop until done_tool is called
      const success = await this._executeLoop();
      
      // Generate summary using LLM
      const { success: summarySuccess, summary } = await this._generateSummary();
      
      if (success && summarySuccess) {
        return { success: true, summary };
      } else {
        return { 
          success: false, 
          summary: summary || 'Task could not be completed',
          error: success ? undefined : 'Max steps exceeded'
        };
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if user cancelled
      if (error instanceof AbortError || 
          this.executionContext.isUserCancellation() || 
          (error instanceof Error && error.name === "AbortError")) {
        return {
          success: false,
          summary: 'Task was cancelled',
          error: 'User cancelled'
        };
      }
      
      return {
        success: false,
        summary: 'Task failed due to an error',
        error: errorMessage
      };
    }
  }

  private _initializeExecution(): void {
    // Generate system prompt using the prompt template
    const systemPrompt = generateSubAgentSystemPrompt(
      this.task,
      this.description,
      this.toolManager.getDescriptions()
    );

    this.messageManager.addSystem(systemPrompt);
    
    // Generate task prompt
    const taskPrompt = generateSubAgentTaskPrompt(this.task);
    this.messageManager.addHuman(taskPrompt);
  }

  private _registerTools(): void {
    // Planning and task management
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
    
    // Tab operations
    this.toolManager.register(createTabOperationsTool(this.executionContext));
    
    // Validation and utility
    this.toolManager.register(createValidatorTool(this.executionContext));
    this.toolManager.register(createScreenshotTool(this.executionContext));
    this.toolManager.register(createExtractTool(this.executionContext));
    
    // Note: We don't register SubAgentTool here to avoid recursion
  }

  @Abortable
  private async _executeLoop(): Promise<boolean> {
    let stepCount = 0;
    
    // Simple while loop that executes until done_tool is called
    while (stepCount < SubAgent.MAX_STEPS) {
      this.checkIfAborted();
      stepCount++;
      
      // Get current TODOs and add as AI message
      const todoXml = this.todoStore.getXml();
      let instruction: string;
      if (todoXml === '<todos></todos>') {
        // No TODOs - prompt to create a plan
        instruction = `Based on the task: "${this.task} and description: ${this.description}", create a plan using the planner_tool and add to your TODO list.`;
      } else {
        // Show TODOs and continue executing
        this.messageManager.addAI(`Current TODO list:\n${todoXml}`);
        instruction = `Continue executing the current TODOs.`;

        // Add few proabilistic system reminders
        this._maybeAddSystemReminders();
      }
      
      
      // Execute single turn
      const isDone = await this._executeSingleTurn(instruction);
      
      // Exit when done_tool is called
      if (isDone) {
        return true;
      }
    }
    
    return false;  // Max steps reached
  }

  private checkIfAborted(): void {
    if (this.executionContext.abortController.signal.aborted) {
      throw new AbortError();
    }
  }

  @Abortable
  private async _executeSingleTurn(instruction: string): Promise<boolean> {
    this.messageManager.addHuman(instruction);
    
    const llmResponse = await this._invokeLLMWithStreaming();
    
    let wasDoneToolCalled = false;
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      this.messageManager.add(llmResponse);
      wasDoneToolCalled = await this._processToolCalls(llmResponse.tool_calls);
    } else if (llmResponse.content) {
      this.messageManager.addAI(llmResponse.content as string);
    }
    
    return wasDoneToolCalled;
  }

  @Abortable
  private async _invokeLLMWithStreaming(): Promise<AIMessage> {
    const llm = await this.executionContext.getLLM();
    if (!llm.bindTools || typeof llm.bindTools !== 'function') {
      throw new Error('LLM does not support tool binding');
    }

    const messages = this.messageManager.getMessages();
    const llmWithTools = llm.bindTools(this.toolManager.getAll());
    const stream = await llmWithTools.stream(messages, {
      signal: this.executionContext.abortController.signal
    });
    
    let accumulatedChunk: AIMessageChunk | undefined;
    let accumulatedText = '';
    let hasStartedThinking = false;

    for await (const chunk of stream) {
      this.checkIfAborted();

      if (chunk.content && typeof chunk.content === 'string') {
        if (!hasStartedThinking) {
          this.eventEmitter.startThinking();
          hasStartedThinking = true;
        }
        
        this.eventEmitter.streamThoughtDuringThinking(chunk.content);
        accumulatedText += chunk.content;
      }
      accumulatedChunk = !accumulatedChunk ? chunk : accumulatedChunk.concat(chunk);
    }
    
    if (hasStartedThinking && accumulatedText.trim()) {
      this.eventEmitter.finishThinking(accumulatedText);
    }
    
    if (!accumulatedChunk) return new AIMessage({ content: '' });
    
    return new AIMessage({
      content: accumulatedChunk.content,
      tool_calls: accumulatedChunk.tool_calls,
    });
  }

  @Abortable
  private async _processToolCalls(toolCalls: any[]): Promise<boolean> {
    let wasDoneToolCalled = false;
    
    for (const toolCall of toolCalls) {
      this.checkIfAborted();

      const { name: toolName, args, id: toolCallId } = toolCall;
      const tool = this.toolManager.get(toolName);
      
      if (!tool) {
        continue;
      }

      this.eventEmitter.toolStart(toolName, args);
      const result = await tool.func(args);
      const parsedResult = JSON.parse(result);
      
      const displayMessage = formatToolOutput(toolName, parsedResult);
      this.eventEmitter.debug('SubAgent executing tool: ' + toolName + ' result: ' + displayMessage);
      
      // Skip emitting refresh_browser_state_tool to prevent browser state from appearing in UI
      // The browser state is internal context that should not be shown to users
      // Also skip result_tool to avoid duplicating the final summary in the UI
      if (toolName !== 'refresh_browser_state_tool' && toolName !== 'result_tool') {
        this.eventEmitter.emitToolResult(toolName, result);
      }
      this.messageManager.addTool(result, toolCallId);

      // Special handling for specific tools
      if (toolName === 'refresh_browser_state_tool' && parsedResult.ok) {
        this.messageManager.addBrowserState(parsedResult.output);
      }

      if (toolName === 'todo_manager_tool' && parsedResult.ok && args.action !== 'list') {
        this.messageManager.addSystemReminder(
          `TODO list updated. Current state:\n${this.todoStore.getXml()}`
        );
        this.eventEmitter.info(formatTodoList(this.todoStore.getJson(), 'SubAgent'));
      }

      if (toolName === 'done_tool' && parsedResult.ok) {
        wasDoneToolCalled = true;
      }
    }
    
    return wasDoneToolCalled;
  }
  
  private async _maybeAddSystemReminders(): Promise<void> {
    if (this._getRandom(0.4)) {
      this.messageManager.addSystemReminder(
        `REMINDER: Mark your TODOs as soon as you complete them. Do NOT batch them for later."`
      );
    }
    if (this._getRandom(0.7)) {
      this.messageManager.addSystemReminder(
        `REMINDER: If you are stuck, use validator_tool to assess and re-plan.`
      );
    }
    if (this._getRandom(0.3)) {
      this.messageManager.addSystemReminder(
        `REMINDER: You can use screenshot_tool for visual reference of the page if you need more clarity."`
      );
    }
  }

  private _getRandom(probability: number): boolean {
    return Math.random() < probability;
  }

  private async _generateSummary(): Promise<{ success: boolean; summary: string }> {
    try {
      // Get LLM instance
      const llm = await this.executionContext.getLLM({ temperature: 0.3 });
      
      // Get message history - filter to tool messages for conciseness
      const readOnlyMessageManager = new MessageManagerReadOnly(this.messageManager);
      const messageHistory = readOnlyMessageManager.getAll()
        .filter(m => m instanceof ToolMessage)
        .map(m => m.content)
        .join('\n');
      
      // Get final browser state
      const browserState = await this.executionContext.browserContext.getBrowserStateString();
      
      // Create prompt for summary generation
      const systemPrompt = `You are a task summarizer. Analyze the execution history and generate a brief summary.`;
      const taskPrompt = `Task: ${this.task}
Description: ${this.description}

Execution History:
${messageHistory}

Final Browser State:
${browserState}

Based on the execution history and final state, determine if the task was successfully completed and provide a brief 1-2 sentence summary of what was accomplished.`;
      
      // Get structured response from LLM with retry logic
      const structuredLLM = llm.withStructuredOutput(SubAgentSummarySchema);
      const result = await invokeWithRetry<{ success: boolean; summary: string }>(
        structuredLLM,
        [
          new SystemMessage(systemPrompt),
          new HumanMessage(taskPrompt)
        ],
        3
      );
      
      return result;
    } catch (error) {
      // Fallback on error
      return {
        success: false,
        summary: 'Failed to generate summary'
      };
    }
  }
}
