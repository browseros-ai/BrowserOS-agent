import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManager } from '@/lib/runtime/MessageManager';
import { ToolManager } from '@/lib/tools/ToolManager';
import { TodoStore } from '@/lib/runtime/TodoStore';
import { EventProcessor } from '@/lib/events/EventProcessor';
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
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
import { PLANNING_CONFIG } from '@/lib/tools/planning/PlannerTool.config';

interface Plan {
  steps: Array<{
    action: string;
    reasoning: string;
  }>;
}

/**
 * SubAgent - A self-contained agent that can execute multi-step tasks
 * Used by SubAgentTool to handle complex task execution in isolation
 */
export class SubAgent {
  private static readonly MAX_CYCLES = 5;  // Max plan-execute-validate cycles
  private static readonly MAX_STEPS_PER_CYCLE = 15;  // Max steps in each execution cycle
  
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
    // Keep parent's browser context, abort controller, and event processors
    // But use our own message manager and todo store
    this.executionContext = new ExecutionContext({
      browserContext: parentContext.browserContext,
      messageManager: this.messageManager,
      abortController: parentContext.abortController,
      debugMode: parentContext.debugMode,
      eventBus: parentContext.getEventBus(),
      eventProcessor: parentContext.getEventProcessor(),
      todoStore: this.todoStore
    });
    
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
      
      // Execute plan-execute-validate cycles
      const success = await this._executePlanCycles();
      
      if (success) {
        const summary = await this._generateSummary();
        return { success: true, summary };
      } else {
        return { 
          success: false, 
          summary: 'Task could not be completed within the allowed cycles',
          error: 'Max cycles exceeded'
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
    // Create system prompt for subagent
    const systemPrompt = `You are a sub-agent tasked with completing a specific objective.

Your task: ${this.task}
Description: ${this.description}

You have access to various browser automation tools. Use them to complete your task.
Work methodically and verify your progress using refresh_browser_state.
Call done_tool when you have successfully completed the task.

Available tools: ${this.toolManager.getDescriptions()}`;

    this.messageManager.addSystem(systemPrompt);
    this.messageManager.addHuman(`Please complete this task: ${this.task}`);
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
  private async _executePlanCycles(): Promise<boolean> {
    const todoStore = this.todoStore;
    
    for (let cycle = 0; cycle < SubAgent.MAX_CYCLES; cycle++) {
      this.checkIfAborted();
      
      // Show current TODO state if any
      const todoXml = todoStore.getXml();
      if (todoXml !== '<todos></todos>') {
        this.messageManager.addAI(`Current TODO list:\n${todoXml}`);
        this.eventEmitter.info(formatTodoList(todoStore.getJson()));
      }
      
      // 1. Create plan
      const plan = await this._createPlan();
      if (plan.steps.length === 0) {
        this.eventEmitter.debug('No more steps to plan');
        break;
      }
      
      // Convert plan to TODOs
      await this._updateTodosFromPlan(plan);
      this.eventEmitter.info(formatTodoList(todoStore.getJson()));
      
      // 2. Execute TODOs
      let stepCount = 0;
      while (stepCount < SubAgent.MAX_STEPS_PER_CYCLE && !todoStore.isAllDoneOrSkipped()) {
        this.checkIfAborted();
        
        const todo = todoStore.getNextTodo();
        if (!todo) break;
        
        stepCount++;
        
        this.eventEmitter.info(`SubAgent executing: ${todo.content}...`);
        
        const instruction = `Current TODO: "${todo.content}". Complete this TODO. Before marking it as complete, you MUST:
1. Call refresh_browser_state to get the current page state
2. Verify that the TODO is actually achieved based on the current state
3. If TODO is done, mark it as complete using todo_manager with action 'complete'
4. If this TODO is not yet done, continue executing on it`;

        const isDone = await this._executeSingleTurn(instruction);
        
        if (isDone) {
          return true;  // Task completed successfully
        }
      }
      
      // 3. Validate progress
      const validation = await this._validateProgress();
      if (validation.isComplete) {
        return true;
      }
      
      // Add validation feedback for next cycle
      if (validation.suggestions.length > 0) {
        const feedback = `Validation: ${validation.reasoning}\nSuggestions: ${validation.suggestions.join(', ')}`;
        this.messageManager.addAI(feedback);
      }
    }
    
    return false;  // Max cycles reached
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

      this.eventEmitter.executingTool(toolName, args);
      const result = await tool.func(args);
      const parsedResult = JSON.parse(result);
      
      const displayMessage = formatToolOutput(toolName, parsedResult);
      this.eventEmitter.debug('SubAgent executing tool: ' + toolName + ' result: ' + displayMessage);
      
      this.eventEmitter.emitToolResult(toolName, result);
      this.messageManager.addTool(result, toolCallId);

      // Special handling for specific tools
      if (toolName === 'refresh_browser_state' && parsedResult.ok) {
        this.messageManager.addSystemReminder(parsedResult.output);
      }

      if (toolName === 'todo_manager' && parsedResult.ok && args.action !== 'list') {
        this.messageManager.addSystemReminder(
          `TODO list updated. Current state:\n${this.todoStore.getXml()}`
        );
        this.eventEmitter.info(formatTodoList(this.todoStore.getJson()));
      }

      if (toolName === 'done_tool' && parsedResult.ok) {
        wasDoneToolCalled = true;
      }
    }
    
    return wasDoneToolCalled;
  }

  @Abortable
  private async _createPlan(): Promise<Plan> {
    const plannerTool = this.toolManager.get('planner_tool')!;
    const args = {
      task: `Continue working on: ${this.task}`,
      max_steps: PLANNING_CONFIG.STEPS_PER_PLAN
    };

    this.eventEmitter.executingTool('planner_tool', args);
    const result = await plannerTool.func(args);
    const parsedResult = JSON.parse(result);
    
    const planner_formatted_output = formatToolOutput('planner_tool', parsedResult);
    this.eventEmitter.toolEnd('planner_tool', parsedResult.ok, planner_formatted_output);

    if (parsedResult.ok && parsedResult.output?.steps) {
      return { steps: parsedResult.output.steps };
    }
    return { steps: [] };
  }

  private async _updateTodosFromPlan(plan: Plan): Promise<void> {
    const todos = plan.steps.map(step => ({
      content: step.action
    }));
    
    const todoTool = this.toolManager.get('todo_manager');
    if (todoTool && todos.length > 0) {
      const args = { action: 'add_multiple' as const, todos };
      await todoTool.func(args);
    }
  }

  private async _validateProgress(): Promise<{
    isComplete: boolean;
    reasoning: string;
    suggestions: string[];
  }> {
    const validatorTool = this.toolManager.get('validator_tool');
    if (!validatorTool) {
      return {
        isComplete: false,
        reasoning: 'Validator not available',
        suggestions: []
      };
    }

    const args = { task: this.task };
    try {
      this.eventEmitter.executingTool('validator_tool', args);
      const result = await validatorTool.func(args);
      const parsedResult = JSON.parse(result);
      
      const validator_formatted_output = formatToolOutput('validator_tool', parsedResult);
      this.eventEmitter.toolEnd('validator_tool', parsedResult.ok, validator_formatted_output);
      
      if (parsedResult.ok) {
        const validationData = JSON.parse(parsedResult.output);
        return {
          isComplete: validationData.isComplete,
          reasoning: validationData.reasoning,
          suggestions: validationData.suggestions || []
        };
      }
    } catch (error) {
      // Continue on validation error
    }
    
    return {
      isComplete: false,
      reasoning: 'Validation failed',
      suggestions: []
    };
  }

  private async _generateSummary(): Promise<string> {
    // Get final browser state
    const browserState = await this.executionContext.browserContext.getBrowserStateString();
    
    // Create a simple summary
    const summary = `Successfully completed task: ${this.task}. ${this.description}`;
    
    return summary;
  }
}