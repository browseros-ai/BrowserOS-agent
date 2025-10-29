### High-Level Design
- **Core Tool**: Single `TodoManagerTool` for all operations: list (XML output), add_multiple (append with auto-index), add_after_position (insert after index, shift others), complete_multiple (by IDs), skip_multiple (set to "skipped" status), replace_all (clear and add new with re-indexing).
- **Schema Simplification**: TODO: {id: number (1-based index), content: string, status: "todo" | "doing" | "done" | "skipped"}. Enforce one "doing" at a time; auto-increment/shift IDs on adds.
- **Store**: TodoStore class in ExecutionContext (plain class, no zustand). 
- **Output**: Tool returns JSON with `ok` boolean and `output` containing result. For 'list' action, output contains XML string.
- **System Reminders**: Auto-added after mutating operations via ExecutionContext.addSystemReminder(); includes updated TODO list in XML format.
- **Integration**: 
  - **Classification**: Only for complex tasks (ClassificationTool determines this)
  - **Planning Phase**: Before planning, inject current TODO list. PlannerTool creates plan steps which become TODOs
  - **Execution Phase**: Execute TODOs sequentially, each TODO gets max 5 tool calls. Mark as "doing" before execution, "done"/"skipped" after
  - **Re-planning**: When TODO fails or new requirements emerge, mark as "skipped" and continue to next TODO.
- **Prompt Enhancements**: System prompt instructs: Use TodoManagerTool for complex tasks only. Create TODOs from plan steps. Mark doing before working, complete/skip after. Parse XML in messages.
- **Edge Cases**: 
  - Re-index on inserts/skips to maintain 1-based sequential IDs
  - Cap list at 30 TODOs
  - On abort, reset "doing" to "todo"
  - If TODO requires verification, keep as "doing" until verified

### Pseudo Code

```typescript
// src/lib/tools/planning/TodoTool.ts

// Schema
const TodoSchema = z.object({
  id: z.number().int().positive(),
  content: z.string(),
  status: z.enum(['todo', 'doing', 'done', 'skipped']),
});

// Input Schema
// NTN -- skip is always a single todo. TODOinputschema still accepts ids, but you validate that for skip it is single todo and ADD this is TODO tool description. Like n the todo tool description add differention options
// NTN -- I removed add_after_position because it that became complex.
const TodoInputSchema = z.object({
  action: z.enum(['list', 'add_multiple', 'complete_multiple', 'skip', 'replace_all']),
  todos: z.array(z.object({ content: z.string() })).optional(),  // For add/replace
  ids: z.array(z.number().int()).optional(),  // For complete/skip
});

// TodoStore
class TodoStore {
  private todos: Array<z.infer<typeof TodoSchema>> = [];

  getAll(): Array<z.infer<typeof TodoSchema>> { return this.todos; }

  addMultiple(newTodos: string[]): void {  // contents only
    const startId = this.todos.length + 1;
    newTodos.forEach((content, i) => this.todos.push({ id: startId + i, content, status: 'todo' }));
  }

  completeMultiple(ids: number[]): void {
    ids.forEach(id => { const t = this.todos.find(t => t.id === id); if (t) t.status = 'done'; });
  }

  skip(id: number): void {
    this.todos = this.todos.filter(t => t.id !== id);  // Remove and reindex
    this.reindex();
  }

  replaceAll(newTodos: string[]): void {
    this.todos = [];
    this.addMultiple(newTodos);
  }

  markDoing(id: number): void {
    if (this.todos.some(t => t.status === 'doing')) throw new Error('One doing only');
    const t = this.todos.find(t => t.id === id);
    if (t) t.status = 'doing';
  }

  reindex(): void {
    this.todos.forEach((t, i) => t.id = i + 1);
  }

  getCurrentDoing(): z.infer<typeof TodoSchema> | null { return this.todos.find(t => t.status === 'doing') || null; }

  checkPending() // any todos not marked as done or skipped
  
  getNextTodo(): z.infer<typeof TodoSchema> | null {
    // Auto-marks as doing when retrieved
    const current = this.getCurrentDoing();
    if (current) return current;  // Already have one in progress
    
    const pending = this.getPending();
    if (pending.length === 0) return null;
    
    // Mark first pending as doing
    pending[0].status = 'doing';
    return pending[0];
  }

  isCompleted(id: number): boolean { const t = this.todos.find(t => t.id === id); return t?.status === 'done' or skiiped }

  getXml(): string {
    return '<todos>' + this.todos.map(t => `<todo id="${t.id}" status="${t.status}">${t.content}</todo>`).join('') + '</todos>';
  }
}

// Tool Factory
export function createTodoManagerTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const todoStore = executionContext.todoStore;
  return new DynamicStructuredTool({
    name: 'todo_manager',
    description: 'Manage TODO list for complex tasks. Actions: list (get current TODOs), add_multiple (add new TODOs), add_after_position (insert TODOs after position), complete_multiple (mark as done), skip_multiple (mark as skipped), replace_all (clear and add new).',
    schema: TodoInputSchema,
    func: async (args): Promise<string> => {
      try {
        let resultMessage = 'Success';
        switch (args.action) {
          case 'list_todos': 
            return JSON.stringify({ ok: true, output: todoStore.getXml() });
          
          case 'add_multiple_todos':
            if (!args.todos || args.todos.length === 0) throw new Error('Todos required');
            todoStore.addMultiple(args.todos.map(t => t.content));
            resultMessage = `Added ${args.todos.length} TODOs`;
            break;
          

          
          case 'complete_multiple_todos':
            if (!args.ids || args.ids.length === 0) throw new Error('IDs required');
            todoStore.completeMultiple(args.ids);
            resultMessage = `Completed TODOs: ${args.ids.join(', ')}`;
            break;
          
          case 'skip_todo':
            if (!args.id) throw new Error('ID required');
            todoStore.skip(args.id);
            resultMessage = `Skipped TODO: ${args.id}`;
            break;
          
          case 'replace_all_todos':
            if (!args.todos) throw new Error('Todos required');
            todoStore.replaceAll(args.todos.map(t => t.content));
            resultMessage = `Replaced all TODOs with ${args.todos.length} new items`;
            break;
        }
        
        // Add system reminder for mutating operations
        if (args.action !== 'list') {
          executionContext.addSystemReminder(`TODO list updated. Current state:\n${todoStore.getXml()}`);
        }
        
        return JSON.stringify({ ok: true, output: resultMessage });
      } catch (error) {
        return JSON.stringify({ ok: false, error: error.message });
      }
    },
  });
}
```

```typescript
// NTN -- this method should be in MessageManager
  addSystemReminder(content: string): void {
    this.messageManager.addSystem(`<browser-state>${content}</browser-state>`);
  }

/// NTN -- in browseragent, there should be a method to fetch latest todo list and add it to message manager as a system reminder.
```

```typescript
// src/lib/agent/BrowserAgent.ts (pseudo integration in _executeMultiStepStrategy)
// Register tool: this.toolManager.register(createTodoTool(this.executionContext));

// In strategy:
private async _executeMultiStepStrategy(task: string): Promise<void> {
  let step_index = 0;
  while (step_index < MAX_TOTAL_STEPS) {
    // Fetch & inject
    const todoXml = await this._fetchTodoXml();  // todo_tool 'list'
    this.messageManager.addAI(`Current TODOs: ${todoXml}`);


    // Execute loop over pending
    // NTN -- this should be while loop -- YOU FETCH NEXT TODO FROM TODOSTORE AND EXECUTE IT.
    // NTN -- when fetched, you should mark it as doing.

  }
}
private async _executeTodo(task: string): Promise<void> {
    this.events.info('Executing as a multi-step task.');
    let step_index = 0;

    while (step_index < BrowserAgent.MAX_TOTAL_STEPS) {
      this.checkIfAborted();  // Check if the user has cancelled the task before executing

      // Fetch & inject
      const todoXml = await this._fetchTodoXml();  // todo_tool 'list'
      this.messageManager.addAI(`TODO list (as of now): ${todoXml}`);

      // 1. PLAN: Create a new plan for the next few steps

    // Plan (LLM calls todo_tool after via prompt instruction)
     const plan = await this._createMultiStepPlan(task);  // Prompt: "After planning, call todo_tool to update/add from steps."      if (plan.steps.length === 0) {
        throw new Error('Planning failed. Could not generate next steps.');
      }
      this.events.info(`Created new plan: ${JSON.stringify(plan, null, 2)}`);

      // 2. EXECUTE: Execute until TODO list is either all marked as done or all marked as skipped.
      /// NTN -- add a function to check if all todos are done or skipped.
      while (steps< MAX_TOTAL_STEPS && !todoStore.isAllDoneOrSkipped()) {
        this.checkIfAborted();  // Check if the user has cancelled the task before executing

        const todo = todoStore.getNextTodo();
        step_index++;
        this.events.info(`Step ${step_index}: ${step.action}`);
        
        const isTaskCompleted = await this._executeSingleTurn(step.action);

        if (isTaskCompleted) {
          this.events.complete('Task completed successfully.');
          return;  // SUCCESS
        }
      }
      
      // 3. VALIDATE: Check if task is complete after plan segment
      const validationResult = await this._validateTaskCompletion(task);
      if (validationResult.isComplete) {
        this.events.complete(`Task validated as complete: ${validationResult.reasoning}`);
        return;
      }
      
      // 4. CONTINUE: Add validation result to message manager for planner
      if (validationResult.suggestions.length > 0) {
        const validationMessage = `Validation result: ${validationResult.reasoning}\nSuggestions: ${validationResult.suggestions.join(', ')}`;
        this.messageManager.addAI(validationMessage);
        
        // Emit validation result to debug events
        this.events.debug(`Validation result: ${JSON.stringify(validationResult, null, 2)}`);
      }
      
    }
    throw new Error(`Task did not complete within the maximum of ${BrowserAgent.MAX_TOTAL_STEPS} steps.`);
```

```typescript
// System Prompt Snippet (in generateSystemPrompt)
# TODO Management
For complex: Fetch list XML before planning. Plan steps, then call todo_tool (add_multiple/replace_all/add_after_position) to update.
Work on one TODO at a time: Set doing, use tools (multi-calls ok), complete/skip immediately after.
Parse <todo> XML in reminders/history.
Skip if irrelevant.
No for simple tasks.
```

## Implementation Phases

### Phase 1: Core TODO Infrastructure (Foundation)
Tasks:
1. Create TodoStore class in src/lib/runtime/TodoStore.ts with all core methods
2. Add todoStore property to ExecutionContext class
3. Create TodoManagerTool in src/lib/tools/planning/TodoManagerTool.ts
4. Write unit tests for TodoStore (CRUD operations, state transitions, edge cases)
5. Write unit tests for TodoManagerTool (all actions, error handling)

### Phase 2: BrowserAgent Integration (Execution)
Tasks:
1. Register TodoManagerTool in BrowserAgent's tool initialization
2. Modify _executeMultiStepStrategy to use TODO-driven execution
3. Update _createMultiStepPlan to return TODOs instead of steps
4. Implement TODO execution loop with getNextTodo()
5. Add system reminders for TODO state changes
6. Handle abort scenarios (reset "doing" to "todo")
7. Write integration tests for TODO-driven execution flow

### Phase 3: Planning & Prompts Integration (Intelligence)
Tasks:
1. Update PlannerTool to output TODO-compatible format
2. Modify ClassificationTool prompt to mention TODO usage for complex tasks
3. Update BrowserAgent system prompt to include TODO management instructions
4. Add TODO context injection before planning (current state as XML)
5. Implement re-planning logic with TODO context
6. Add TODO state to MessageManager for conversation history
7. Write end-to-end tests for complex task scenarios

Each phase builds on the previous one and can be implemented independently.
