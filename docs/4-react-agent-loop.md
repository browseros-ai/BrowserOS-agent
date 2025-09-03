# React Agent Loop Design

## Overview

This document outlines the design and implementation strategy for integrating a React (Reasoning + Acting) agent execution pattern into the existing BrowserAgent architecture. The React pattern, based on the paper "ReAct: Synergizing Reasoning and Acting in Language Models", provides a structured approach for agents to alternate between reasoning about tasks and taking actions.

## Background

### Current Execution Strategies

The BrowserAgent currently implements two execution strategies:

1. **Simple Task Strategy** (`_executeSimpleTaskStrategy`)
   - Direct execution without planning
   - Maximum 10 attempts
   - Suitable for straightforward, single-step tasks

2. **Multi-Step Strategy** (`_executeMultiStepStrategy`)
   - Plan → Execute → Validate → Re-plan cycle
   - Uses PlannerTool for structured planning
   - TODO list management for progress tracking
   - Suitable for complex, multi-step tasks

### React Pattern Advantages

The React pattern offers:
- **Explicit Reasoning**: Each action is preceded by thought/reasoning
- **Better Interpretability**: Clear chain of thought visible to users
- **Improved Error Recovery**: Reasoning helps identify when to change approach
- **Natural Language Flow**: More conversational and understandable execution

## Design Options

### Option 1: LangChain React Agent Integration

Leverage LangChain's `createReactAgent` and `AgentExecutor` for standard React behavior.

```typescript
private async _executeReactAgentStrategy(task: string): Promise<void> {
  // Pull the React prompt template
  const reactPrompt = await pull<PromptTemplate>("hwchase17/react");
  
  // Get LLM from execution context
  const llm = await this.executionContext.getLLM();
  
  // Create React agent with existing tools
  const agent = await createReactAgent({
    llm: llm,
    tools: this.toolManager.getAll(),
    prompt: reactPrompt
  });
  
  // Create AgentExecutor with streaming
  const agentExecutor = new AgentExecutor({
    agent,
    tools: this.toolManager.getAll(),
    maxIterations: 15,
    returnIntermediateSteps: true
  });
  
  // Stream execution with PubSub integration
  const eventStream = agentExecutor.streamEvents(
    { input: task },
    { version: "v2", signal: this.executionContext.abortController.signal }
  );
  
  for await (const event of eventStream) {
    this.checkIfAborted();
    // Process and publish events via PubSub
  }
}
```

**Pros:**
- Minimal code changes
- Proven implementation
- Compatible with existing tools

**Cons:**
- Less control over execution flow
- May need tool wrappers

### Option 2: Custom React Implementation (Recommended)

Build a custom React strategy that integrates with existing planning and validation infrastructure.

## Detailed Implementation: Enhanced Custom React Strategy

### Core Architecture

```typescript
private async _executeCustomReactStrategy(task: string): Promise<void> {
  const MAX_REACT_ITERATIONS = 30;
  const PLAN_EVERY_N_STEPS = 5;
  const VALIDATE_EVERY_N_STEPS = 3;
  
  // State tracking
  let currentPlan: Plan | null = null;
  let iterationCount = 0;
  let consecutiveFailures = 0;
  let lastValidation: ValidationResult | null = null;
  
  // Enhanced React system prompt
  const reactSystemPrompt = this._generateReactSystemPrompt();
  this.messageManager.addSystem(reactSystemPrompt);
  
  // Phase 1: Initial classification and planning
  const classification = await this._classifyTask(task);
  
  if (!classification.is_simple_task) {
    currentPlan = await this._createMultiStepPlan(task);
    await this._updateTodosFromPlan(currentPlan);
  }
  
  // Phase 2: React execution loop
  for (let i = 0; i < MAX_REACT_ITERATIONS; i++) {
    this.checkIfAborted();
    iterationCount++;
    
    // Periodic validation
    if (i > 0 && i % VALIDATE_EVERY_N_STEPS === 0) {
      lastValidation = await this._validateProgressInReactLoop(task, currentPlan);
      if (lastValidation.isComplete) return;
    }
    
    // Periodic re-planning
    if (currentPlan && i > 0 && i % PLAN_EVERY_N_STEPS === 0) {
      if (await this._shouldReplan(task, currentPlan, iterationCount)) {
        currentPlan = await this._createMultiStepPlan(task);
      }
    }
    
    // Execute React step
    const stepResult = await this._executeReactStep(task, currentPlan, i);
    
    if (stepResult.doneToolCalled) return;
    if (stepResult.requirePlanningCalled) {
      currentPlan = await this._createMultiStepPlan(task);
    }
    
    // Loop detection
    if (this._detectLoop()) {
      currentPlan = await this._replanWithContext(task, lastValidation);
    }
  }
}
```

### Key Components

#### 1. React System Prompt

```typescript
private _generateReactSystemPrompt(): string {
  return `You are an advanced ReAct agent with planning and validation capabilities.

EXECUTION PATTERN:
1. Thought: Analyze the current situation and what needs to be done
2. Decision: Determine if you need to plan, execute a tool, or validate progress
3. Action: Execute the chosen tool
4. Observation: Process the result and update your understanding

SPECIAL TOOLS:
- planner_tool: Use when you need a structured multi-step plan
- validator_tool: Use to check if the task is complete
- todo_manager_tool: Use to track your progress visually
- require_planning_tool: Use when the current approach isn't working

IMPORTANT:
- For complex tasks, start by creating a plan
- Regularly validate your progress
- If stuck, request re-planning
- When complete, use done_tool with a summary`;
}
```

#### 2. React Step Execution

```typescript
private async _executeReactStep(
  task: string,
  currentPlan: Plan | null,
  stepNumber: number
): Promise<SingleTurnResult> {
  // Build context-aware prompt
  let prompt = `Step ${stepNumber + 1} of ReAct execution for task: ${task}\n\n`;
  
  if (currentPlan) {
    const todoState = await this._getCurrentTodoState();
    prompt += `Current Progress:\n${todoState}\n\n`;
  }
  
  prompt += `Based on the conversation and current state:
1. THOUGHT: What should I do next and why?
2. ACTION: Which tool should I use?`;
  
  // Execute with streaming
  this.messageManager.addHuman(prompt);
  const response = await this._invokeLLMWithStreaming();
  
  // Extract and display thought
  if (response.content) {
    const thought = this._extractThought(response.content as string);
    if (thought) {
      this.pubsub.publishMessage(
        PubSub.createMessage(`💭 ${thought}`, 'ultrathinking')
      );
    }
  }
  
  // Process tool calls
  if (response.tool_calls?.length > 0) {
    const result = await this._processToolCalls(response.tool_calls);
    await this._updateTodoProgress(response.tool_calls[0].name);
    return result;
  }
  
  return { doneToolCalled: false, requirePlanningCalled: false, requiresHumanInput: false };
}
```

#### 3. Progress Validation

```typescript
private async _validateProgressInReactLoop(
  task: string,
  currentPlan: Plan | null
): Promise<ValidationResult> {
  const validatorTool = this.toolManager.get('validator_tool');
  if (!validatorTool) return { isComplete: false, reasoning: "", suggestions: [] };
  
  const result = await validatorTool.func({ task, include_suggestions: true });
  const parsed = JSON.parse(result);
  
  if (parsed.ok && parsed.output) {
    const validation = parsed.output;
    
    // Publish insights
    this.pubsub.publishMessage(
      PubSub.createMessage(`📊 Validation: ${validation.reasoning}`, 'thinking')
    );
    
    if (validation.suggestions?.length > 0) {
      this.pubsub.publishMessage(
        PubSub.createMessage(`💡 Suggestions: ${validation.suggestions.join(', ')}`, 'thinking')
      );
    }
    
    return validation;
  }
  
  return { isComplete: false, reasoning: "Validation failed", suggestions: [] };
}
```

#### 4. Intelligent Re-planning

```typescript
private async _shouldReplan(
  task: string,
  currentPlan: Plan,
  iterationCount: number
): Promise<boolean> {
  const todoState = await this._getTodoCompletionMetrics();
  const { completedCount, totalCount } = todoState;
  
  if (totalCount === 0) return false;
  
  const completionRate = completedCount / totalCount;
  const stepsPerTodo = iterationCount / Math.max(completedCount, 1);
  
  // Replan if progress is too slow or completion rate is low
  return (stepsPerTodo > 5 && completionRate < 0.5) || 
         (iterationCount > 10 && completionRate < 0.3);
}

private async _replanWithContext(
  task: string,
  validation: ValidationResult | null
): Promise<Plan> {
  this.pubsub.publishMessage(
    PubSub.createMessage("🔄 Creating new plan based on feedback", 'ultrathinking')
  );
  
  if (validation) {
    const context = `Previous validation: ${validation.reasoning}
Suggestions: ${validation.suggestions.join(', ')}`;
    this.messageManager.addAI(context);
  }
  
  return await this._createMultiStepPlan(task);
}
```

#### 5. TODO Synchronization

```typescript
private async _updateTodoProgress(toolName: string): Promise<void> {
  const todoTool = this.toolManager.get('todo_manager_tool');
  if (!todoTool) return;
  
  const result = await todoTool.func({ action: 'get' });
  const currentTodos = JSON.parse(result).output || '';
  
  // Smart TODO completion based on tool execution
  const lines = currentTodos.split('\n');
  let updated = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('- [ ]')) {
      // Match tool name to TODO item
      const todoText = lines[i].toLowerCase();
      const toolKeyword = toolName.replace(/_tool$/, '').replace(/_/g, ' ');
      
      if (todoText.includes(toolKeyword)) {
        lines[i] = lines[i].replace('- [ ]', '- [x]');
        updated = true;
        break;
      }
    }
  }
  
  if (updated) {
    await todoTool.func({ action: 'set', todos: lines.join('\n') });
  }
}
```

## Integration Strategy

### 1. Triggering React Mode

Add to the `execute()` method:

```typescript
// Option A: Via classification
if (classification.use_react_pattern) {
  await this._executeCustomReactStrategy(task);
  return;
}

// Option B: Via metadata
if (metadata?.executionMode === 'react') {
  await this._executeCustomReactStrategy(task);
  return;
}

// Option C: Via task complexity
if (classification.complexity === 'high' || task.includes('reason')) {
  await this._executeCustomReactStrategy(task);
  return;
}
```

### 2. Classification Tool Enhancement

Update ClassificationTool to detect when React pattern would be beneficial:

```typescript
// In ClassificationTool
const needsReactPattern = (task: string): boolean => {
  const reactIndicators = [
    'analyze and',
    'think about',
    'reason through',
    'step by step',
    'explain your thinking',
    'debug',
    'troubleshoot'
  ];
  
  return reactIndicators.some(indicator => 
    task.toLowerCase().includes(indicator)
  );
};
```

## Benefits of This Approach

### 1. Best of Both Worlds
- Combines React's explicit reasoning with existing planning infrastructure
- Maintains TODO visibility for user feedback
- Preserves validation and re-planning capabilities

### 2. Adaptive Execution
- Automatically switches strategies based on progress
- Detects stuck states and forces new approaches
- Adjusts planning frequency based on performance

### 3. Full Observability
- Real-time thought streaming via PubSub
- TODO progress tracking
- Validation insights displayed to user

### 4. Robust Error Recovery
- Multiple mechanisms to detect and recover from failures
- Context-aware re-planning based on validation
- Loop detection with automatic strategy switching

### 5. Seamless Integration
- Uses existing ToolManager and MessageManager
- Compatible with current streaming infrastructure
- Maintains abort/cancellation support

## Performance Considerations

### Token Management
- React pattern generates more tokens due to explicit reasoning
- Mitigated by MessageManager's automatic trimming at 60% capacity
- Consider shorter React prompts for token efficiency

### Execution Speed
- Additional reasoning steps may increase execution time
- Balanced by better decision-making and fewer errors
- Validation intervals can be adjusted for performance

### Memory Usage
- Tracking additional state (plans, validations, metrics)
- Minimal overhead compared to benefits
- State cleared between executions

## Future Enhancements

### 1. Meta-Reasoning
Add a meta-reasoning layer that evaluates the React process itself:

```typescript
private async _metaReasoning(history: Message[]): Promise<{
  switchStrategy: boolean;
  adjustParameters: Record<string, any>;
}> {
  // Analyze execution patterns and suggest improvements
}
```

### 2. Learning from Execution
Track successful patterns and adjust React behavior:

```typescript
private async _learnFromExecution(task: string, success: boolean): Promise<void> {
  // Store patterns that led to success/failure
  // Adjust future React prompts based on learning
}
```

### 3. Hybrid Strategies
Combine React with other patterns dynamically:

```typescript
private async _executeHybridStrategy(task: string): Promise<void> {
  // Start with React for reasoning
  // Switch to direct execution for simple subtasks
  // Use planning for complex sequences
}
```

## Conclusion

The Enhanced Custom React Strategy provides a powerful addition to BrowserAgent's execution capabilities. By combining React's reasoning pattern with existing planning and validation tools, we achieve:

- **Better interpretability** through explicit reasoning
- **Improved reliability** via validation and re-planning
- **Enhanced user experience** with real-time thought streaming
- **Robust error recovery** through multiple fallback mechanisms

This design maintains backward compatibility while offering a sophisticated execution pattern for complex tasks that benefit from explicit reasoning and iterative refinement.