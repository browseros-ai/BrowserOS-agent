import { MemoryManager } from "../../memory/MemoryManager";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { MemoryCategory } from "../../memory/types";

/**
 * Simple memory tool for agents to store and retrieve information
 */
export class SimpleMemoryTool {
  public readonly name = "memory_tool";
  public readonly description =
    "Store and retrieve information across tasks and sessions";

  constructor(
    private executionContext: ExecutionContext,
    private memoryManager: MemoryManager
  ) {}

  async call(input: string): Promise<string> {
    try {
      const args = JSON.parse(input);

      const currentPage =
        await this.executionContext.browserContext.getCurrentPage();
      const tabId = currentPage.tabId;
      const pageUrl = await currentPage.url();
      const site = pageUrl ? new URL(pageUrl).hostname : undefined;

      const baseMetadata = {
        agentId: this.memoryManager.getAgentId(),
        tabId,
        url: pageUrl,
        site,
        taskId:
          args.taskId || this.executionContext.getCurrentTask() || undefined,
        tags: args.tags,
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

          const result = await this.memoryManager.addMemory(args.content, {
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

          const searchResult = await this.memoryManager.searchMemories({
            query: args.query,
            category: args.category as MemoryCategory,
            taskId: args.taskId,
            tabId: baseMetadata.tabId,
            limit: args.limit,
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

          const context = await this.memoryManager.getTaskContext(args.taskId);

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

          const result = await this.memoryManager.addMemory(args.content, {
            ...baseMetadata,
            category: MemoryCategory.TASK_RESULT,
            importance: args.importance ?? 0.7,
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
          const preferences = await this.memoryManager.getMemoriesByCategory(
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
  }
}

/**
 * Factory function to create memory tool instance
 */
export function createSimpleMemoryTool(
  executionContext: ExecutionContext,
  memoryManager: MemoryManager
): SimpleMemoryTool {
  return new SimpleMemoryTool(executionContext, memoryManager);
}
