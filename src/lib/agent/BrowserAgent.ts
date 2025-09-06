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
import { ExecutionMetadata } from '@/lib/types/messaging';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createPlannerTool } from '@/lib/tools/planning/PlannerTool';
import { createTodoManagerTool } from '@/lib/tools/planning/TodoManagerTool';
import { createRequirePlanningTool } from '@/lib/tools/planning/RequirePlanningTool';
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
import { createStorageTool } from '@/lib/tools/utils/StorageTool';
import { createExtractTool } from '@/lib/tools/extraction/ExtractTool';
import { createResultTool } from '@/lib/tools/result/ResultTool';
import { createHumanInputTool } from '@/lib/tools/utils/HumanInputTool';
import { createDateTool } from '@/lib/tools/utility/DateTool';
import { createMCPTool } from '@/lib/tools/mcp/MCPTool';
import { generateSystemPrompt, generateSingleTurnExecutionPrompt } from './BrowserAgent.prompt';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { PLANNING_CONFIG } from '@/lib/tools/planning/PlannerTool.config';
import { AbortError } from '@/lib/utils/Abortable';
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';
// Import evals2 lightweight tool wrapper
import { wrapToolForMetrics } from '@/evals2/EvalToolWrapper';
import { ENABLE_EVALS2 } from '@/config';
import { NarratorService } from '@/lib/services/NarratorService';
import { PubSub } from '@/lib/pubsub'; // For static helper methods
import { HumanInputResponse } from '@/lib/pubsub/types';
import { Logging } from '@/lib/utils/Logging';
import { jsonParseToolOutput } from '@/lib/utils/utils';

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

interface SingleTurnResult {
  doneToolCalled: boolean;
  requirePlanningCalled: boolean;
  requiresHumanInput: boolean;
}

export class BrowserAgent {
  // Constants for explicit control
  private static readonly MAX_STEPS_FOR_SIMPLE_TASKS = 10;
  private static readonly MAX_STEPS_FOR_COMPLEX_TASKS = PLANNING_CONFIG.STEPS_PER_PLAN;

  // Outer loop is -- plan -> execute -> validate
  private static readonly MAX_STEPS_OUTER_LOOP = 100;
  
  // Human input constants
  private static readonly HUMAN_INPUT_TIMEOUT = 600000;  // 10 minutes
  private static readonly HUMAN_INPUT_CHECK_INTERVAL = 500;  // Check every 500ms

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
  private toolsRegistered = false;  // Track if tools have been registered
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
  
  private get pubsub(): PubSub { 
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
   * Main entry point.
   * Orchestrates classification and delegates to the appropriate execution strategy.
   * @param task - The task/query to execute
   * @param metadata - Optional execution metadata for controlling execution mode
   */
  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    try {
      // 1. SETUP: Initialize system prompt and user task
      this._initializeExecution(task);

      // 2. CHECK FOR PREDEFINED PLAN
      if (metadata?.executionMode === 'predefined' && metadata.predefinedPlan) {
        // Treat predefined plan as a fresh (non-follow-up) task: clear history and re-init
        this.messageManager.clear();
        this._initializeExecution(task);
        // Route predefined plan through the multi-step strategy using initial plan
        const predefined = metadata!.predefinedPlan!;
        this.pubsub.publishMessage(PubSub.createMessage(`Executing agent: ${predefined.name || 'Custom Agent'}`, 'thinking'));
        // Convert predefined steps to Plan structure
        const initialPlan: Plan = {
          steps: predefined.steps.map(step => ({ action: step, reasoning: `Part of agent: ${predefined.name || 'Custom'}` }))
        };
        if (predefined.goal) {
          this.messageManager.addHuman(`User's goal is: ${predefined.goal} and this is the task: ${task}`);
        }
        await this._executeMultiStepStrategy(task, initialPlan);
        await this._generateTaskResult(task);
        return;
      }
      else if (metadata?.executionMode === 'dynamic' && metadata?.source === 'newtab') {
        // For tasks initiated from new tab, show the startup message with task
        this.pubsub.publishMessage(PubSub.createMessage(`Executing task: ${task}`, 'thinking'));
      }

      // 3. STANDARD FLOW: CLASSIFY task type
      const classification = await this._classifyTask(task);
      
      // Log classification result to console for visibility
      if (ENABLE_EVALS2) {
        console.log(`%c→ Classification: ${classification.is_simple_task ? 'simple' : 'complex'}`, 'color: #888; font-size: 10px');
      }
      
      // Clear message history if this is not a follow-up task
      if (!classification.is_followup_task) {
        this.messageManager.clear();
        this._initializeExecution(task);
      }
      
      let message: string;
      if (classification.is_followup_task && this.messageManager.getMessages().length > 0) {
        message = 'Following up on previous task...';
      } else if (classification.is_simple_task) {
        message = 'Executing your task...';
      } else {
        message = 'Creating a plan to complete the task...';
      }
      this.pubsub.publishMessage(PubSub.createMessage(message, 'narration'));

      // 4. DELEGATE: Route to the correct execution strategy
      if (classification.is_simple_task) {
        await this._executeSimpleTaskStrategy(task);
      } else {
        await this._executeMultiStepStrategy(task);
      }

      // 5. FINALISE: Generate final result
      await this._generateTaskResult(task);
      
      // Task completion is logged by NxtScape, not here
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
    // Register all tools first
    this.toolManager.register(createPlannerTool(this.executionContext));
    this.toolManager.register(createTodoManagerTool(this.executionContext));
    this.toolManager.register(createRequirePlanningTool(this.executionContext));
    this.toolManager.register(createDoneTool(this.executionContext));
    
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
    this.toolManager.register(createStorageTool(this.executionContext));
    this.toolManager.register(createExtractTool(this.executionContext));
    this.toolManager.register(createHumanInputTool(this.executionContext));
    this.toolManager.register(createDateTool(this.executionContext));
    
    // Result tool
    this.toolManager.register(createResultTool(this.executionContext));
    
    // MCP tool for external integrations
    this.toolManager.register(createMCPTool(this.executionContext));
    
    // Register classification tool last with all tool descriptions
    const toolDescriptions = this.toolManager.getDescriptions();
    this.toolManager.register(createClassificationTool(this.executionContext, toolDescriptions));
  }

  private async _classifyTask(task: string): Promise<ClassificationResult> {
    const classificationTool = this.toolManager.get('classification_tool');
    if (!classificationTool) {
      // Default to complex task if classification tool not found
      return { is_simple_task: false, is_followup_task: false };
    }

    const args = { task };
    
    try {
      // Tool start notification not needed in new pub-sub system
      // Tool start notification not needed in new pub-sub system
      const result = await classificationTool.func(args);
      const parsedResult = jsonParseToolOutput(result);
      
      if (parsedResult.ok) {
        const classification = parsedResult.output;
        // Tool end notification not needed in new pub-sub system
        // Tool end notification not needed in new pub-sub system
        return { 
          is_simple_task: classification.is_simple_task,
          is_followup_task: classification.is_followup_task 
        };
      }
    } catch (error) {
      // Tool end notification not needed in new pub-sub system
      // Tool end notification not needed in new pub-sub system
    }
    
    // Default to complex task on any failure
    return { is_simple_task: false, is_followup_task: false };
  }

  // ===================================================================
  //  Execution Strategy 1: Simple Tasks (No Planning)
  // ===================================================================
  private async _executeSimpleTaskStrategy(task: string): Promise<void> {
    // Debug: Executing as a simple task

    for (let attempt = 1; attempt <= BrowserAgent.MAX_STEPS_FOR_SIMPLE_TASKS; attempt++) {
      this.checkIfAborted();  // Manual check in loop

      // Check for loop before continuing
      if (this._detectLoop()) {
        const loopMessage = 'Detected repetitive behavior. Breaking out of potential infinite loop.';
        console.warn(loopMessage);
        this.pubsub.publishMessage(PubSub.createMessage(loopMessage, 'error'));
        return;
      }

      // Debug: Attempt ${attempt}/${BrowserAgent.MAX_STEPS_FOR_SIMPLE_TASKS}

      const instruction = `The user's goal is: "${task}". Please take the next best action to complete this goal and call the 'done_tool' when finished.`;
      const turnResult = await this._executeSingleTurn(instruction);

      if (turnResult.doneToolCalled) {
        return;  // SUCCESS - task result will be generated in execute()
      }
      
      if (turnResult.requiresHumanInput) {
        // Human input requested - wait for response
        const humanResponse = await this._waitForHumanInput();
        
        if (humanResponse === 'abort') {
          // Human aborted the task
          this.pubsub.publishMessage(PubSub.createMessage('❌ Task aborted by human', 'assistant'));
          throw new AbortError('Task aborted by human');
        }
        
        // Human clicked "Done" - continue with next iteration
        this.pubsub.publishMessage(PubSub.createMessage('✅ Human completed manual action. Continuing...', 'thinking'));
        this.messageManager.addAI('Human has completed the requested manual action. Continuing with the task.');
        
        // Clear human input state
        this.executionContext.clearHumanInputState();
        
        // Continue to next attempt
        continue;
      }
      
      // Note: require_planning_tool doesn't make sense for simple tasks
      // but if called, we could escalate to complex strategy      
    }

    throw new Error(`Task failed to complete after ${BrowserAgent.MAX_STEPS_FOR_SIMPLE_TASKS} attempts.`);
  }

  // ===================================================================
  //  Execution Strategy 2: Multi-Step Tasks (Plan -> Execute -> Repeat)
  // ===================================================================
  private async _executeMultiStepStrategy(task: string, initialPlan?: Plan): Promise<void> {
    // Debug: Executing as a complex multi-step task
    let outer_loop_index = 0;

    while (outer_loop_index < BrowserAgent.MAX_STEPS_OUTER_LOOP) {
      this.checkIfAborted();

      // 1. PLAN: Use provided initial plan for first cycle, otherwise create a new plan
      let plan: Plan;
      if (outer_loop_index === 0 && initialPlan) {
        // Use the provided initial plan without creating a new one
        plan = initialPlan;
        this.pubsub.publishMessage(PubSub.createMessage(`Using predefined plan with ${initialPlan.steps.length} steps`, 'thinking'));
      } else {
        // Create a new plan for subsequent iterations or when no initial plan
        plan = await this._createMultiStepPlan(task);
      }

      // 2. Convert plan to TODOs
      await this._updateTodosFromPlan(plan);

      // Show TODO list after plan creation
      const todoTool = this.toolManager.get('todo_manager_tool');
      let currentTodos = '';
      if (todoTool) {
        const result = await todoTool.func({ action: 'get' });
        const parsedResult = jsonParseToolOutput(result);
        currentTodos = parsedResult.output || '';
        this.pubsub.publishMessage(PubSub.createMessage(currentTodos, 'thinking'));
      }

      // 3. EXECUTE: Inner loop with one TODO per turn
      let inner_loop_index = 0;
      
      // Continue while there are uncompleted tasks (- [ ]) in the markdown
      while (inner_loop_index < BrowserAgent.MAX_STEPS_INNER_LOOP && currentTodos.includes('- [ ]')) {
        this.checkIfAborted();
        
        // Check for loop before continuing
        if (this._detectLoop()) {
          console.warn('Detected repetitive behavior. Breaking out of potential infinite loop.');
          
          // break out of loop
          throw new Error("Agent is stuck, please restart your task.");
        }
        
        // Use the generateTodoExecutionPrompt for TODO execution
        const instruction = generateSingleTurnExecutionPrompt(task);
        
        const turnResult = await this._executeSingleTurn(instruction);
        inner_loop_index++;
        
        if (turnResult.doneToolCalled) {
          return; // Task fully complete - exit entire strategy
        }
        
        if (turnResult.requirePlanningCalled) {
          // Agent explicitly requested re-planning
          console.log('Agent requested re-planning, breaking inner loop');
          break; // Exit inner loop to trigger re-planning
        }
        
        if (turnResult.requiresHumanInput) {
          // Human input requested - wait for response
          const humanResponse = await this._waitForHumanInput();
          
          if (humanResponse === 'abort') {
            // Human aborted the task
            this.pubsub.publishMessage(PubSub.createMessage('❌ Task aborted by human', 'assistant'));
            throw new AbortError('Task aborted by human');
          }
          
          // Human clicked "Done" - add to message history and trigger re-planning
          this.pubsub.publishMessage(PubSub.createMessage('✅ Human completed manual action. Re-planning...', 'thinking'));
          this.messageManager.addAI('Human has completed the requested manual action. Continuing with the task.');
          
          // Clear human input state
          this.executionContext.clearHumanInputState();
          
          // Break inner loop to trigger re-planning
          break;
        }
        
        // Update currentTodos for the next iteration
        if (todoTool) {
          const result = await todoTool.func({ action: 'get' });
          const parsedResult = jsonParseToolOutput(result);
          currentTodos = parsedResult.output || '';
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
   * @returns {Promise<SingleTurnResult>} - Information about which tools were called
   */
  private async _executeSingleTurn(instruction: string): Promise<SingleTurnResult> {
    this.messageManager.addHuman(instruction);
    
    // This method encapsulates the streaming logic
    const llmResponse = await this._invokeLLMWithStreaming();

    console.log(`K tokens:\n${JSON.stringify(llmResponse, null, 2)}`)

    const result: SingleTurnResult = {
      doneToolCalled: false,
      requirePlanningCalled: false,
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
      result.requirePlanningCalled = toolsResult.requirePlanningCalled;
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
      requirePlanningCalled: false,
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

      // Add evals2 lightweight wrapping if enabled
      let toolFunc = tool.func;
      if (ENABLE_EVALS2) {
        const wrappedTool = wrapToolForMetrics(tool, this.executionContext, toolCallId);
        toolFunc = wrappedTool.func;
      }

      const toolResult = await toolFunc(args);
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

      // Special handling for todo_manager_tool, replace existing todo list message
      if (toolName === 'todo_manager_tool' && parsedResult.ok && args.action === 'set') {
        const markdown = args.todos || '';
        this.messageManager.addTodoList(markdown);
        this.pubsub.publishMessage(PubSub.createMessage(markdown, 'thinking'));
      }


      if (toolName === 'done_tool' && parsedResult.ok) {
        result.doneToolCalled = true;
      }
      
      if (toolName === 'require_planning_tool' && parsedResult.ok) {
        result.requirePlanningCalled = true;
      }
      
      if (toolName === 'human_input_tool' && parsedResult.ok && parsedResult.requiresHumanInput) {
        result.requiresHumanInput = true;
        // Break from the loop immediately to handle human input
        break;
      }
    }
    
    return result;
  }

  private async _createMultiStepPlan(task: string): Promise<Plan> {
    const plannerTool = this.toolManager.get('planner_tool')!;
    const args = {
      task: `Based on the history, continue with the main goal: ${task}`,
      max_steps: BrowserAgent.MAX_STEPS_FOR_COMPLEX_TASKS
    };

    const result = await plannerTool.func(args);
    const parsedResult = jsonParseToolOutput(result);
    
    // Check for errors first
    if (!parsedResult.ok) {
      // Throw with actual error from tool
      throw new Error(parsedResult.output || 'Planning failed');
    }
    
    // Publish planner result
    if (parsedResult.output?.steps) {
      const message = `Created ${parsedResult.output.steps.length} step execution plan`;
      this.pubsub.publishMessage(PubSub.createMessage(message, 'thinking'));
      return { steps: parsedResult.output.steps };
    }
    
    throw new Error('Invalid plan format - no steps returned');
  }

  private async _createMultiStepPlanWithPreview(task: string): Promise<Plan> {
    const initialPlan = await this._createMultiStepPlan(task)
    
    const planId = `plan_${Date.now()}`
    const editablePlan = {
      planId,
      steps: initialPlan.steps.map((step, index) => ({
        id: `step_${index}_${Date.now()}`,
        action: step.action,
        reasoning: step.reasoning || '',
        order: index,
        isEditable: true
      })),
      task,
      isPreview: true
    }
    
    this.pubsub.publishMessage(PubSub.createMessage(
      JSON.stringify(editablePlan), 
      'plan_editor'
    ))
    
    const finalPlan = await this._waitForPlanConfirmation(planId)
    
    if (finalPlan === 'cancelled') {
      throw new AbortError('Plan editing was cancelled by user')
    }
    
    return finalPlan
  }

  private async _waitForPlanConfirmation(planId: string): Promise<Plan | 'cancelled'> {
    return new Promise((resolve) => {
      const subscription = this.pubsub.subscribe((event) => {
        if (event.type === 'plan-edit-response' && event.payload.planId === planId) {
          subscription.unsubscribe()
          
          if (event.payload.action === 'execute' && event.payload.steps) {
            const editedPlan: Plan = {
              steps: event.payload.steps.map((step) => ({
                action: step.action,
                reasoning: step.reasoning || ''
              }))
            }
            resolve(editedPlan)
          } else {
            resolve('cancelled')
          }
        }
      })
      
      setTimeout(() => {
        subscription.unsubscribe()
        resolve('cancelled')
      }, 5 * 60 * 1000)
    });
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
   * Update TODOs from plan steps (replaces all existing TODOs)
   */
  private async _updateTodosFromPlan(plan: Plan): Promise<void> {
    const todoTool = this.toolManager.get('todo_manager_tool');
    if (!todoTool || plan.steps.length === 0) return;
    
    // Convert plan steps to markdown TODO list
    const markdown = plan.steps
      .map(step => `- [ ] ${step.action}`)
      .join('\n');
    
    const args = { action: 'set' as const, todos: markdown };
    await todoTool.func(args);
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
    const subscription = this.pubsub.subscribe((event) => {
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
        if (Date.now() - startTime > BrowserAgent.HUMAN_INPUT_TIMEOUT) {
          this.pubsub.publishMessage(
            PubSub.createMessage('⏱️ Human input timed out after 10 minutes', 'error')
          );
          return 'timeout';
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, BrowserAgent.HUMAN_INPUT_CHECK_INTERVAL));
      }
      
      // Aborted externally
      return 'abort';
      
    } finally {
      // Clean up subscription
      subscription.unsubscribe();
    }
  }
}
