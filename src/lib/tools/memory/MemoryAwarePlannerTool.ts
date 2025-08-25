import { DynamicStructuredTool } from "@langchain/core/tools";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MemoryCategory } from "../../memory/types";
import { createPlannerTool } from "../planning/PlannerTool";

/**
 * Create memory-aware planner tool that learns from past successful plans
 */
export function createMemoryAwarePlannerTool(
  executionContext: ExecutionContext
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "memory_aware_planner_tool",
    description: `Enhanced planning tool that learns from past successful plans and incorporates user preferences. 
    Use this instead of regular planner when you want to leverage memory for better planning.`,

    // Use simplified schema to avoid TypeScript issues
    schema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The task to plan for",
        },
        max_steps: {
          type: "number",
          minimum: 1,
          maximum: 20,
          default: 10,
          description: "Maximum number of steps in the plan",
        },
        use_memory: {
          type: "boolean",
          default: true,
          description: "Whether to use memory for context",
        },
        learn_from_patterns: {
          type: "boolean",
          default: true,
          description: "Whether to learn from past patterns",
        },
      },
      required: ["task"],
    } as any,

    func: async (args: any) => {
      try {
        const memoryManager = executionContext.getMemoryManager();
        let contextualInfo = "";
        let userPreferences = {};
        let pastPatterns: string[] = [];

        if (
          args.use_memory !== false &&
          memoryManager &&
          memoryManager.isEnabled()
        ) {
          // 1. Search for relevant past successful plans
          if (args.learn_from_patterns !== false) {
            const pastPlans = await memoryManager.searchMemories({
              query: args.task,
              category: MemoryCategory.SUCCESSFUL_PLAN,
              limit: 3,
            });

            if (pastPlans.entries.length > 0) {
              pastPatterns = pastPlans.entries.map((entry) => entry.content);
              contextualInfo += `\nPast successful approaches for similar tasks:\n${pastPatterns.join(
                "\n"
              )}\n`;
            }
          }

          // 2. Get user preferences
          const preferences = await memoryManager.getMemoriesByCategory(
            MemoryCategory.USER_PREFERENCE,
            10
          );

          preferences.forEach((pref) => {
            try {
              const parsed = JSON.parse(pref.content);
              Object.assign(userPreferences, parsed);
            } catch {
              // Skip invalid JSON, treat as text preference
              if (
                pref.content.toLowerCase().includes(args.task.toLowerCase())
              ) {
                contextualInfo += `\nUser preference: ${pref.content}\n`;
              }
            }
          });

          // 3. Search for relevant research or context data
          const relevantContext = await memoryManager.searchMemories({
            query: args.task,
            category: MemoryCategory.RESEARCH_DATA,
            limit: 5,
          });

          if (relevantContext.entries.length > 0) {
            contextualInfo += `\nRelevant context from previous research:\n`;
            relevantContext.entries.forEach((entry) => {
              contextualInfo += `- ${entry.content.substring(0, 200)}...\n`;
            });
          }

          // 4. Get task-specific context if available
          const currentTask = executionContext.getCurrentTask();
          if (currentTask) {
            const taskContext = await memoryManager.getTaskContext(currentTask);
            if (
              taskContext &&
              Object.keys(taskContext.intermediateResults).length > 0
            ) {
              contextualInfo += `\nCurrent task progress:\n`;
              Object.entries(taskContext.intermediateResults).forEach(
                ([key, value]) => {
                  contextualInfo += `- ${value}\n`;
                }
              );
            }
          }
        }

        // Generate enhanced prompt for planning
        const enhancedTaskPrompt = `
Task: ${args.task}
Max Steps: ${args.max_steps || 10}

${contextualInfo}

${
  Object.keys(userPreferences).length > 0
    ? `User Preferences: ${JSON.stringify(userPreferences, null, 2)}\n`
    : ""
}

Please create a step-by-step plan that:
1. Takes into account the user's preferences and past successful patterns
2. Leverages any relevant context or research data mentioned above
3. Is optimized based on learned patterns from similar tasks
4. Includes memory storage of important intermediate results

Generate a plan with ${args.max_steps || 10} or fewer steps.
`;

        // Create and use the regular planner tool with enhanced context
        const regularPlannerTool = createPlannerTool(executionContext);
        const plannerResult = await regularPlannerTool.func({
          task: enhancedTaskPrompt,
          max_steps: args.max_steps || 10,
        });

        const parsedResult = JSON.parse(plannerResult);

        // If planning was successful and memory is enabled, store the plan pattern
        if (
          parsedResult.ok &&
          args.use_memory !== false &&
          memoryManager &&
          memoryManager.isEnabled()
        ) {
          const planSummary = `Task type: ${args.task}\nSteps: ${
            parsedResult.output?.steps?.length || 0
          }\nSuccess pattern learned`;

          await memoryManager.addMemory(planSummary, {
            category: MemoryCategory.WORKFLOW_PATTERN,
            importance: 0.7,
            tags: args.task.split(" ").slice(0, 3), // First 3 words as tags
          });
        }

        return plannerResult;
      } catch (error) {
        return JSON.stringify({
          ok: false,
          error: `Memory-aware planning failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    },
  });
}
