import {
  MemoryEntry,
  MemoryMetadata,
  MemorySearchParams,
  MemorySearchResult,
  MemoryOperationResult,
  MemoryConfig,
  MemoryStats,
  MemoryCategory,
  TaskContext,
  AgentMemoryContext,
} from "./types";
import { Mem0ClientWrapper } from "./Mem0ClientWrapper";
import { MemoryEventBus } from "./MemoryEventBus";
import { v4 as uuidv4 } from "uuid";

/**
 * MemoryManager - Central orchestrator for the memory system
 *
 * This class provides the main interface for memory operations, managing
 * both local cache and cloud storage through Mem0.
 */
export class MemoryManager {
  private mem0Client: Mem0ClientWrapper;
  private eventBus: MemoryEventBus;
  private config: MemoryConfig;
  private localCache: Map<string, MemoryEntry> = new Map();
  private agentId: string;
  private sessionId: string;

  constructor(
    apiKey?: string,
    config: Partial<MemoryConfig> = {},
    agentId: string = "default"
  ) {
    this.mem0Client = new Mem0ClientWrapper(apiKey);
    this.eventBus = new MemoryEventBus();
    this.agentId = agentId;
    this.sessionId = uuidv4();

    // Merge with default config
    this.config = {
      enabled: true,
      maxEntries: 1000,
      retentionDays: 30,
      autoCleanup: true,
      importantThreshold: 0.7,
      enableCrossTab: true,
      enableLearning: true,
      ...config,
    };
  }

  /**
   * Initialize the memory manager
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await this.mem0Client.initialize();
      console.log("MemoryManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize MemoryManager:", error);
      throw error;
    }
  }

  /**
   * Add a memory entry
   */
  async addMemory(
    content: string,
    metadata: Partial<MemoryMetadata> = {}
  ): Promise<MemoryOperationResult> {
    if (!this.config.enabled) {
      return { success: false, message: "Memory is disabled" };
    }

    try {
      const fullMetadata: MemoryMetadata = {
        agentId: this.agentId,
        sessionId: this.sessionId,
        ...metadata,
      };

      const result = await this.mem0Client.addMemory(content, fullMetadata);

      if (result.success && result.data) {
        // Update local cache
        const memoryEntry: MemoryEntry = {
          id: result.data.id || uuidv4(),
          content,
          metadata: fullMetadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.localCache.set(memoryEntry.id, memoryEntry);

        // Emit event
        this.eventBus.emit("memory_added", {
          entryId: memoryEntry.id,
          category: fullMetadata.category,
          agentId: this.agentId,
          tabId: fullMetadata.tabId,
          timestamp: new Date(),
        });

        return {
          success: true,
          message: "Memory added successfully",
          data: memoryEntry,
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: `Failed to add memory: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Search memories with enhanced filtering
   */
  async searchMemories(
    params: Partial<MemorySearchParams>
  ): Promise<MemorySearchResult> {
    if (!this.config.enabled) {
      return { entries: [], total: 0, hasMore: false };
    }

    try {
      const searchParams: MemorySearchParams = {
        query: params.query || "",
        agentId: params.agentId || this.agentId,
        limit: params.limit || 10,
        ...params,
      };

      const result = await this.mem0Client.searchMemories(searchParams);

      // Update local cache with results
      result.entries.forEach((entry) => {
        this.localCache.set(entry.id, entry);
      });

      // Emit search event
      this.eventBus.emit("memory_searched", {
        category: searchParams.category,
        agentId: this.agentId,
        tabId: searchParams.tabId,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      console.error("Memory search failed:", error);
      return { entries: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get memories by category
   */
  async getMemoriesByCategory(
    category: MemoryCategory,
    limit: number = 20
  ): Promise<MemoryEntry[]> {
    const result = await this.searchMemories({
      query: "",
      category,
      limit,
    });
    return result.entries;
  }

  /**
   * Get recent memories for context
   */
  async getRecentMemories(limit: number = 10): Promise<MemoryEntry[]> {
    try {
      const result = await this.mem0Client.getAllMemories(this.agentId, limit);

      // Sort by creation date (most recent first)
      const sortedEntries = result.entries.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      return sortedEntries.slice(0, limit);
    } catch (error) {
      console.error("Failed to get recent memories:", error);
      return [];
    }
  }

  /**
   * Get task-specific context
   */
  async getTaskContext(taskId: string): Promise<TaskContext | null> {
    try {
      const memories = await this.searchMemories({
        query: "",
        taskId,
        limit: 50,
      });

      if (memories.entries.length === 0) {
        return null;
      }

      // Build task context from memories
      const taskContext: TaskContext = {
        taskId,
        currentStep: 0,
        totalSteps: 0,
        intermediateResults: {},
        userPreferences: {},
        errorHistory: [],
      };

      // Process memories to build context
      memories.entries.forEach((entry) => {
        if (entry.metadata.category === MemoryCategory.TASK_RESULT) {
          taskContext.intermediateResults[entry.id] = entry.content;
        } else if (entry.metadata.category === MemoryCategory.USER_PREFERENCE) {
          try {
            const pref = JSON.parse(entry.content);
            Object.assign(taskContext.userPreferences, pref);
          } catch {
            // Ignore JSON parse errors
          }
        } else if (entry.metadata.category === MemoryCategory.ERROR_SOLUTION) {
          taskContext.errorHistory.push({
            error: entry.content,
            solution: entry.content,
            timestamp: entry.createdAt,
          });
        }
      });

      return taskContext;
    } catch (error) {
      console.error("Failed to get task context:", error);
      return null;
    }
  }

  /**
   * Store successful workflow pattern
   */
  async storeWorkflowPattern(
    pattern: string,
    success: boolean,
    metadata: Partial<MemoryMetadata> = {}
  ): Promise<MemoryOperationResult> {
    return this.addMemory(pattern, {
      ...metadata,
      category: MemoryCategory.WORKFLOW_PATTERN,
      importance: success ? 0.8 : 0.3,
    });
  }

  /**
   * Store tool result for future reference
   */
  async storeToolResult(
    toolName: string,
    result: any,
    success: boolean,
    metadata: Partial<MemoryMetadata> = {}
  ): Promise<MemoryOperationResult> {
    const content = `Tool: ${toolName}, Success: ${success}, Result: ${JSON.stringify(
      result
    )}`;

    return this.addMemory(content, {
      ...metadata,
      category: MemoryCategory.TOOL_RESULT,
      toolName,
      importance: success ? 0.6 : 0.4,
    });
  }

  /**
   * Store user preference
   */
  async storeUserPreference(
    key: string,
    value: any,
    metadata: Partial<MemoryMetadata> = {}
  ): Promise<MemoryOperationResult> {
    const content = `User preference: ${key} = ${JSON.stringify(value)}`;

    return this.addMemory(content, {
      ...metadata,
      category: MemoryCategory.USER_PREFERENCE,
      importance: 0.9,
    });
  }

  /**
   * Get agent memory context
   */
  async getAgentContext(): Promise<AgentMemoryContext> {
    const recentMemories = await this.getRecentMemories(20);

    const context: AgentMemoryContext = {
      agentId: this.agentId,
      sessionId: this.sessionId,
      lastActivity: new Date(),
      preferences: {},
      learnings: [],
    };

    // Extract preferences and learnings from memories
    recentMemories.forEach((memory) => {
      if (memory.metadata.category === MemoryCategory.USER_PREFERENCE) {
        try {
          const pref = JSON.parse(memory.content);
          Object.assign(context.preferences, pref);
        } catch {
          // Ignore parse errors
        }
      } else if (memory.metadata.category === MemoryCategory.WORKFLOW_PATTERN) {
        context.learnings.push({
          pattern: memory.content,
          success: (memory.metadata.importance || 0) > 0.5,
          confidence: memory.metadata.importance || 0.5,
        });
      }
    });

    return context;
  }

  /**
   * Clear memories for a specific tab
   */
  async clearTabMemories(tabId: number): Promise<MemoryOperationResult> {
    try {
      // Note: Mem0 doesn't have bulk delete by filter, so we need to search and delete individually
      const memories = await this.searchMemories({
        query: "",
        tabId,
        limit: 100,
      });

      let deletedCount = 0;
      for (const memory of memories.entries) {
        const result = await this.mem0Client.deleteMemory(
          memory.id,
          this.agentId
        );
        if (result.success) {
          deletedCount++;
          this.localCache.delete(memory.id);
        }
      }

      return {
        success: true,
        message: `Deleted ${deletedCount} memories for tab ${tabId}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear tab memories: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<MemoryStats> {
    try {
      const allMemories = await this.mem0Client.getAllMemories(
        this.agentId,
        1000
      );

      const stats: MemoryStats = {
        totalEntries: allMemories.total,
        entriesByCategory: {} as Record<MemoryCategory, number>,
        tabCount: 0,
        lastUpdated: new Date(),
      };

      // Initialize categories
      Object.values(MemoryCategory).forEach((category) => {
        stats.entriesByCategory[category] = 0;
      });

      // Count by category and tabs
      const tabIds = new Set<number>();
      allMemories.entries.forEach((entry) => {
        if (entry.metadata.category) {
          stats.entriesByCategory[entry.metadata.category] =
            (stats.entriesByCategory[entry.metadata.category] || 0) + 1;
        }
        if (entry.metadata.tabId) {
          tabIds.add(entry.metadata.tabId);
        }
      });

      stats.tabCount = tabIds.size;

      return stats;
    } catch (error) {
      console.error("Failed to get memory stats:", error);
      return {
        totalEntries: 0,
        entriesByCategory: {} as Record<MemoryCategory, number>,
        tabCount: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Check if memory system is enabled and ready
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Subscribe to memory events
   */
  onMemoryEvent(callback: (event: any) => void): void {
    this.eventBus.subscribe(callback);
  }

  /**
   * Cleanup old memories based on retention policy
   */
  async cleanup(): Promise<void> {
    if (!this.config.autoCleanup) {
      return;
    }

    // This would require implementing a cleanup strategy
    // For now, we'll leave it as a placeholder
    console.log("Memory cleanup not yet implemented");
  }
}
