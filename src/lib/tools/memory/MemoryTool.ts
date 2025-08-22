import { DynamicStructuredTool } from "@langchain/core/tools";
import { MemoryManager } from "../../memory/MemoryManager";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MemoryCategory } from "../../memory/types";

/**
 * Factory function to create memory tool as DynamicStructuredTool
 */
export function createMemoryTool(
  executionContext: ExecutionContext
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "memory_tool",
    description: `Store and retrieve information across tasks and sessions. Use this tool to:
    - Store important results and context for future use
    - Remember user preferences and successful patterns
    - Retrieve relevant information from previous tasks
    - Maintain context across tab switches and navigation
    
    Provide input as JSON string with action and relevant parameters.`,

    schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "add",
            "search",
            "get_context",
            "store_result",
            "get_preferences",
          ],
          description: "Action to perform",
        },
        content: {
          type: "string",
          description: "Content to store (required for add and store_result)",
        },
        query: {
          type: "string",
          description: "Search query (required for search)",
        },
        category: {
          type: "string",
          description: "Memory category",
        },
        taskId: {
          type: "string",
          description: "Task identifier",
        },
        importance: {
          type: "number",
          description: "Importance score between 0 and 1",
        },
        tags: {
          type: "string",
          description: "Tags for categorization",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: ["action"],
    } as any,

    func: async (args: any) => {
      try {
        // Check if memory is enabled
        const memoryManager = executionContext.getMemoryManager();
        if (!memoryManager) {
          return JSON.stringify({
            ok: false,
            error:
              "Memory system is not initialized. Set MEM0_API_KEY environment variable to enable memory.",
          });
        }

        const currentPage =
          await executionContext.browserContext.getCurrentPage();
        const tabId = currentPage.tabId;
        const pageUrl = await currentPage.url();
        const site = pageUrl ? new URL(pageUrl).hostname : undefined;

        const baseMetadata = {
          agentId: memoryManager.getAgentId(),
          tabId,
          url: pageUrl,
          site,
          taskId: args.taskId || executionContext.getCurrentTask() || undefined,
          tags: args.tags
            ? args.tags.split(",").map((t: string) => t.trim())
            : undefined,
          importance: args.importance,
        };

        switch (args.action) {
          case "add": {
            if (!args.content) {
              return JSON.stringify({
                ok: false,
                error: "Content is required for add action",
              });
            }

            const result = await memoryManager.addMemory(args.content, {
              ...baseMetadata,
              category: args.category as MemoryCategory,
            });

            return JSON.stringify({
              ok: result.success,
              output: result.success
                ? `Memory stored successfully: ${args.content.substring(
                    0,
                    100
                  )}...`
                : result.message,
              error: result.success ? undefined : result.message,
            });
          }

          case "search": {
            if (!args.query) {
              return JSON.stringify({
                ok: false,
                error: "Query is required for search action",
              });
            }

            const searchResult = await memoryManager.searchMemories({
              query: args.query,
              category: args.category as MemoryCategory,
              taskId: args.taskId,
              tabId: baseMetadata.tabId,
              limit: args.limit || 10,
            });

            const memories = searchResult.entries.map((entry) => ({
              content: entry.content,
              category: entry.metadata.category,
              created: entry.createdAt.toISOString(),
              importance: entry.metadata.importance,
              tags: entry.metadata.tags,
            }));

            return JSON.stringify({
              ok: true,
              output: {
                memories,
                total: searchResult.total,
                query: args.query,
              },
            });
          }

          case "get_context": {
            if (!args.taskId) {
              return JSON.stringify({
                ok: false,
                error: "Task ID is required for get_context action",
              });
            }

            const context = await memoryManager.getTaskContext(args.taskId);

            return JSON.stringify({
              ok: true,
              output: context
                ? {
                    taskId: context.taskId,
                    intermediateResults: context.intermediateResults,
                    userPreferences: context.userPreferences,
                    errorHistory: context.errorHistory.slice(0, 5),
                  }
                : {
                    message: "No context found for task",
                  },
            });
          }

          case "store_result": {
            if (!args.content) {
              return JSON.stringify({
                ok: false,
                error: "Content is required for store_result action",
              });
            }

            const result = await memoryManager.addMemory(args.content, {
              ...baseMetadata,
              category: MemoryCategory.TASK_RESULT,
              importance: args.importance || 0.7,
            });

            return JSON.stringify({
              ok: result.success,
              output: result.success
                ? `Task result stored successfully`
                : result.message,
              error: result.success ? undefined : result.message,
            });
          }

          case "get_preferences": {
            const preferences = await memoryManager.getMemoriesByCategory(
              MemoryCategory.USER_PREFERENCE,
              20
            );

            const preferenceData = preferences.reduce(
              (acc: Record<string, any>, memory) => {
                try {
                  const parsed = JSON.parse(memory.content);
                  if (typeof parsed === "object") {
                    Object.assign(acc, parsed);
                  }
                } catch {
                  // Skip invalid JSON
                }
                return acc;
              },
              {} as Record<string, any>
            );

            return JSON.stringify({
              ok: true,
              output: {
                preferences: preferenceData,
                count: preferences.length,
              },
            });
          }

          default:
            return JSON.stringify({
              ok: false,
              error: `Unknown action: ${args.action}`,
            });
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          return JSON.stringify({
            ok: false,
            error:
              "Invalid JSON input. Please provide valid JSON with action and parameters.",
          });
        }

        return JSON.stringify({
          ok: false,
          error: `Memory operation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    },
  });
}

// Export for backward compatibility
export const MemoryTool = createMemoryTool;
