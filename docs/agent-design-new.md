# BrowserAgent Design

## Overview

The BrowserAgent is a single, sequential agent for web automation tasks, following a "rolling-horizon" (or receding-horizon) planning model. It plans a small number of upcoming steps (N=3-5), executes them sequentially, and replans dynamically if needed (e.g., on failure, environmental change, or after completing the horizon). This balances foresight with adaptability.

The agent maintains exclusive control over the MessageManager for conversation history. Tools are stateless, receiving only a read-only MessageReader. Tools are implemented using LangChain's DynamicStructuredTool for structured inputs/outputs, ensuring type-safety and compatibility with LLM calls.

Core Principles:
- **Plan-Execute-Replan Cycle**: Generate short-term plans, execute step-by-step, replan as needed.
- **Explicit Control**: Agent alone mutates MessageManager; tools are pure functions.
- **Simple Abstractions**: Minimal classes/interfaces; prompts in separate files; JSON for plan outputs (easier parsing than XML).
- **LLM Integration**: Tools like Planner can call LLM via LangChain chat adapters (e.g., Ollama for testing), with streaming.
- **Conversation Support**: Checks history length/classifies follow-ups at loop start.
- **Extensibility**: ToolRegistry for dynamic tool addition; easy sub-agent forks in future.
Core Principles
Rolling-Horizon Planning: The agent plans a short sequence of steps (N=3 is a good default), executes them, and then re-evaluates, making it both efficient and flexible.

Explicit State Control: The BrowserAgent is the sole owner of the MessageManager. All tools receive a read-only MessageReader, ensuring they cannot mutate the core conversation history.

Simplified Tooling: Tools are defined as simple, standard functions and registered with a ToolRegistry. There are no complex tool classes. The planner itself is a tool that internally calls the LLM.

JSON-based Plans: For simplicity and ease of parsing, plans are structured in JSON instead of XML.



Requirements Mapping:
- Single agent, sequential tool calls: Rolling-horizon loop.
- Message manager ownership: Tools get MessageReader only; agent mutates.
- Steps execution: For-loop over plan steps until 'done'.
- JSON for planning: Structured JSON output from LLM in PlannerTool.
- Planner calls LLM: Yes, with context from MessageReader.
- No "UserPrompt": Use "TaskPrompt" for planner inputs.
- No PlannerTool class: Use DynamicStructuredTool from LangChain.
- ToolRegistry: As provided, with ToolFunction type (args, reader) => Promise<any>.

Directory Structure (relevant):
- `src/lib/agent/BrowserAgent.ts`
- `src/lib/agent/BrowserAgent.prompt.ts` (system prompt)
- `src/lib/tools/ToolRegistry.ts`
- `src/lib/tools/planner/plannerTool.ts` (DynamicStructuredTool setup)
- `src/lib/tools/planner/plannerTool.prompt.ts` (task prompt for LLM)
- `src/lib/tools/utils/doneTool.ts` (DynamicStructuredTool setup)
- `src/lib/tools/utils/doneTool.prompt.ts` (if needed; minimal for non-LLM tools)

## Key Abstractions

### 2.1 MessageManager (Unchanged API, New Helper)

Retain from `lib/runtime/MessageManager.ts`, enhanced with MessageReader and fork.

```typescript
// src/lib/runtime/MessageManager.ts (enhanced)

// Read-only view for tools
export class MessageManagerReadOnly {
  constructor(private mm: MessageManager) {}

  getAll(): BaseMessage[] {
    return this.messageManager.getMessages();
  }
  // NTN -- only add minimum set of methods here -- we can explain later
}

// Add to MessageManager:
fork(includeHistory: boolean = true): MessageManager {
  const newMM = new MessageManager();
  if (includeHistory) newMM.messages = [...this.messages];
  return newMM;
}
```

### 2.2 ToolRegistry

Map for tools, using provided type.

```typescript
// src/lib/tools/base/ToolRegistry.ts
import { DynamicStructuredTool } from '@langchain/core/tools';

// NTN -- I want to call this tool manager
// NTN -- don't add unnecessary methods here -- we can expand later, for now just add ncessary methods
export class ToolManager {
  private tools: Map<string, DynamicStructuredTool> = new Map();

  register(tool: DynamicStructuredTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): DynamicStructuredTool | undefined {
    return this.tools.get(name);
  }

  _registerPlannerTool() {
    // Implementation for registering planner tool
  }

  _registerDoneTool() {
    // Implementation for registering done tool
  }
}
```

### 2.3 Tools

Tools use LangChain's DynamicStructuredTool. Signature: func(args, reader: MessageReader) => Promise<any>. Tools like Planner call LLM internally.

#### PlannerTool (Calls LLM, Outputs JSON Plan)

```typescript
// src/lib/tools/planner/PlannerTool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageReader } from '@/lib/runtime/MessageReader';
import { withStructuredOutput } from '@/lib/llm/utils/structuredOutput';
import { generatePlannerSystemPrompt, generatePlannerTaskPrompt } from './PlannerTool.prompt';


// NTN -- planner input schema shouldn't be complex -- in general for tools, the schema should be simple so that LLM can generate and pass it
// NTN -- for planner to be able to get browser state, we should have passed the argument when creating the tool -- some executin context.browser context. get broser state it can do while execution
const PlannerInputSchema = z.object({
  task: z.string(),  // Task to plan for
  max_steps: z.number().default(3),  // Number of steps to plan
});

// NTN -- plan schema should be simple -- in each step LLM will read the step and then execute it.
const PlanSchema = z.object({
  steps: z.array(z.object({
    action: z.string(),  // What to do
    reasoning: z.string()  // Why this step
  }))
});

// Factory function like NavigationTool
export function createPlannerTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'planner',
    description: 'Generate 3-5 upcoming steps for the task',
    schema: PlannerInputSchema,
    func: async (args): Promise<string> => {
      try {
        const llm = await executionContext.getLLM();
        const reader = new MessageReader(executionContext.messageManager);
        
        // Get prompts
        const systemPrompt = generatePlannerSystemPrompt();
        const taskPrompt = generatePlannerTaskPrompt(
          args.task,
          args.max_steps,
          reader.getAll().map(m => `${m._getType()}: ${m.content}`).join('\n'),
          args.browser_state
        );
        
        // Get structured response
        const structuredLLM = withStructuredOutput(llm, PlanSchema);
        const plan = await structuredLLM.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: taskPrompt }
        ]);
        
        return JSON.stringify({
          ok: true,
          plan: plan,
          output: `Created plan with ${plan.steps.length} steps`
        });
      } catch (error) {
        return JSON.stringify({
          ok: false,
          output: `Planning failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  });
}
```

// NTN -- get these prompts from the previous reference code. /Users/felarof01/Workspaces/build/domain4/reference-code/old-lib/prompts/PlannerToolPrompt.ts
// NTN -- ALL THE PROMPTS SHOULD BE AS SINGLE MULTI LINE STRING.
```typescript
// src/lib/tools/planner/PlannerTool.prompt.ts
export function generatePlannerSystemPrompt();
export function generatePlannerTaskPrompt();
```

#### DoneTool

```typescript
// src/lib/tools/utils/DoneTool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { toolSuccess } from '@/lib/tools/Tool.interface';

const DoneInputSchema = z.object({
  summary: z.string().optional()  // Optional completion summary
});

export function createDoneTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'done',
    description: 'Mark task as complete',
    schema: DoneInputSchema,
    func: async (args): Promise<string> => {
      const summary = args.summary || 'Task completed successfully';
      return JSON.stringify(toolSuccess(summary));
    }
  });
}
```

( No doneTool.prompt.ts needed, as no LLM call.)

## BrowserAgent Implementation

High-Level Pseudocode:
```
Initialize:
  - Load system prompt from BrowserAgent.prompt.ts
  - Add user task as Human message
  - Register tools (planner, navigate, done, etc.) in ToolRegistry
  - Set horizon N = 3 (configurable)

Loop (while !done && iteration < max):
  - If follow-up (history > initial), classify/add context prompt
  - Get browser state string
  - If no current plan or horizon reached, call planner tool with goal from lastHuman
  - Parse JSON plan into steps array
  - For each step in steps (up to N):
    - Parse step {tool, args, reasoning}
    - Get tool from registry
    - Execute tool.func(args, { reader: new MessageReader(mm) })
    - Agent appends result: mm.addAIMessage(`Tool: ${tool}\nReason: ${reasoning}\nResult: ${result.output}`)
    - If tool == 'done' and success, set done = true
  - Increment iteration
  - Replan if needed (e.g., if error or end of horizon)
```

```typescript
// src/lib/agent/BrowserAgent.ts
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { MessageManager } from '@/lib/runtime/MessageManager';
import { MessageReader } from '@/lib/runtime/MessageReader';
import { ToolRegistry } from '@/lib/tools/base/ToolRegistry';
import { createPlannerTool } from '@/lib/tools/planner/PlannerTool';
import { createDoneTool } from '@/lib/tools/utils/DoneTool';
import { createNavigationTool } from '@/lib/tools/navigation/NavigationTool';
import { generateSystemPrompt } from './BrowserAgent.prompt';

const MAX_ITERATIONS = 20;
const HORIZON = 3;

export class BrowserAgent {
  private executionContext: ExecutionContext;
  private messageManager: MessageManager;
  private toolRegistry: ToolRegistry;
  private currentPlan: any[] = [];
  private currentStepOfPlan: number = 0; // NTN -- use this variable name

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.messageManager = executionContext.messageManager;
    this.toolRegistry = new ToolRegistry();
    this._registerTools();
  }

  private _registerTools(): void {
    this.toolRegistry.register(createPlannerTool(this.executionContext));
    this.toolRegistry.register(createDoneTool());
    this.toolRegistry.register(createNavigationTool(this.executionContext.browserContext.getCurrentPage()));
    // Add other tools as needed
  }

  async execute(task: string): Promise<void> {
    // Initialize with system prompt
    const systemPrompt = generateSystemPrompt(this.toolRegistry.getDescriptions());
    this.messageManager.addSystemMessage(systemPrompt);
    this.messageManager.addHumanMessage(task);

    let iteration = 0;
    let taskComplete = false;

    while (!taskComplete && iteration < MAX_ITERATIONS) {
      iteration++;

      // Check if we need to plan (no plan or completed current plan)
      if (this.currentPlan.length === 0 || this.planIndex >= this.currentPlan.length) {
        await this._createPlan(HORIZON, task);
        this.planIndex = 0;
      }

    // NTN -- I want you use to use some of for loop here. Don't use while loop. And structure of the loop should be roughly like this.
    // MAX_ITERATIONS
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // 1. PLAN: If the current plan is empty, create a new one.
      if (this.currentPlan.length === 0) {
        const plannerTool = this.toolRegistry.get('planner')!;
        const planResult = await plannerTool.invoke({ task_prompt: `Based on the history, continue with the main goal: ${task}` });
        this.currentPlan = JSON.parse(planResult).steps;
        this.mm.addAIMessage(`I have created a new 3-step plan.`);
      }

      // 2. EXECUTE: Execute the next step from the current plan.
      const step = this.currentPlan.shift(); // Get and remove the first step
      if (!step) continue;

      const tool = this.toolRegistry.get(step.tool);
      if (!tool) {
        this.mm.addSystemMessage(`Error: Tool "${step.tool}" not found. Re-planning.`);
        this.currentPlan = []; // Clear plan to trigger re-planning
        continue;
      }

      const result = await tool.invoke(step.args);
      this.mm.addToolMessage(result, step.tool);

      if (step.tool === 'done') {
        console.log("Task complete.");
        return;
      }
    }
    console.log("Task failed to complete within the maximum loops.");
  }
    if (this.iteration >= MAX_ITERATIONS) {
      this.mm.addAIMessage('Max iterations reached');
    }
 
  }

// NTN -- there shouldn't be createPlan method, that should be done in the planner tool.
~~private async _createPlan(steps: number, task: string): Promise<void> {}~~

  private async _executeStep(step: {tool: string, args: any, reasoning: string}): Promise<{ok: boolean, output?: string, error?: string}> {
    const tool = this.toolRegistry.get(step.tool);
    if (!tool) {
      return { ok: false, error: `Tool "${step.tool}" not found` };
    }
    
    try {
      const result = await tool.func(step.args);
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private _updateMessages(step: any, result: {ok: boolean, output?: string, error?: string}): void {
    const toolMessage = `Tool: ${step.tool}
Reasoning: ${step.reasoning}
Result: ${result.ok ? result.output || 'Success' : result.error}`;
    
    this.messageManager.addAIMessage(toolMessage);
  }

  private _shouldReplan(result: {ok: boolean, error?: string}): boolean {
    return !result.ok || (result.error?.includes('page changed') ?? false);
  }
}
```

```typescript
// src/lib/agent/BrowserAgent.prompt.ts
// NTN -- get this prompt from the reference code /Users/felarof01/Workspaces/build/domain4/reference-code/old-lib/prompts/BrowseAgentPrompt.ts
export function generateSystemPrompt(toolDescriptions: string): string {}
```

## Integration & Future

### Integration with Nxtscape

```typescript
// src/lib/core/Nxtscape.ts
import { BrowserAgent } from '@/lib/agent/BrowserAgent';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

export class Nxtscape {
  private executionContext: ExecutionContext;

  async run(task: string): Promise<void> {
    const agent = new BrowserAgent(this.executionContext);
    await agent.execute(task);
  }
}
```


## Summary

The design provides a clean, extensible architecture where:
- BrowserAgent maintains strict control over conversation state
- Tools are stateless functions with read-only message access
- Rolling-horizon planning balances foresight with adaptability
- LangChain integration provides structured I/O and streaming
- Clear separation of concerns enables easy testing and extension