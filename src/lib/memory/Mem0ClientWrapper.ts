import MemoryClient from "mem0ai";
import {
  MemoryEntry,
  MemoryMetadata,
  MemorySearchParams,
  MemorySearchResult,
  MemoryOperationResult,
  MemoryCategory,
} from "./types";

/**
 * Mem0ClientWrapper - Handles integration with Mem0 cloud service
 *
 * This class provides a bridge between our memory system and Mem0's cloud API,
 * handling authentication, data transformation, and error management.
 */
export class Mem0ClientWrapper {
  private client: MemoryClient;
  private isInitialized: boolean = false;

  constructor(apiKey?: string) {
    if (!apiKey) {
      // Try to get from environment or throw error
      apiKey = process.env.MEM0_API_KEY;
      if (!apiKey) {
        throw new Error("MEM0_API_KEY environment variable is required");
      }
    }

    this.client = new MemoryClient({ apiKey });
  }

  /**
   * Initialize the client and verify connection
   */
  async initialize(): Promise<void> {
    try {
      // Test the connection by attempting a simple operation
      await this.client.search("test", { user_id: "init-test", limit: 1 });
      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Mem0 client: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Add a memory entry to Mem0
   */
  async addMemory(
    content: string,
    metadata: MemoryMetadata
  ): Promise<MemoryOperationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const userId = this.getUserId(metadata);
      const mem0Metadata = this.transformMetadataForMem0(metadata);

      const messages = [
        {
          role: "user" as const,
          content: content,
        },
      ];

      const result = await this.client.add(messages, {
        user_id: userId,
        metadata: mem0Metadata,
      });

      return {
        success: true,
        message: "Memory added successfully",
        data: result,
      };
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
   * Search memories in Mem0
   */
  async searchMemories(
    params: MemorySearchParams
  ): Promise<MemorySearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const userId = this.getUserId({ agentId: params.agentId || "default" });
      const searchOptions = this.transformSearchParamsForMem0(params);

      const results = await this.client.search(params.query, {
        user_id: userId,
        limit: params.limit,
        ...searchOptions,
      });

      // Transform Mem0 results back to our format
      const entries = await this.transformMem0ResultsToEntries(results);

      return {
        entries,
        total: results.length,
        hasMore: results.length === params.limit,
      };
    } catch (error) {
      console.error("Search failed:", error);
      return {
        entries: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    memoryId: string,
    content: string,
    metadata: MemoryMetadata
  ): Promise<MemoryOperationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.client.update(memoryId, content);

      return {
        success: true,
        message: "Memory updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update memory: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(
    memoryId: string,
    userId: string
  ): Promise<MemoryOperationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.client.delete(memoryId);

      return {
        success: true,
        message: "Memory deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete memory: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Get all memories for a user
   */
  async getAllMemories(
    agentId: string,
    limit: number = 100
  ): Promise<MemorySearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const userId = this.getUserId({ agentId });
      const results = await this.client.getAll({ user_id: userId, limit });

      const entries = await this.transformMem0ResultsToEntries(results);

      return {
        entries,
        total: results.length,
        hasMore: results.length === limit,
      };
    } catch (error) {
      console.error("Get all memories failed:", error);
      return {
        entries: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Get memory history for a user
   */
  async getMemoryHistory(agentId: string): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Note: history() expects a memory_id, not user_id
      // For now, we'll return empty array as we need specific memory IDs
      return [];
    } catch (error) {
      console.error("Get memory history failed:", error);
      return [];
    }
  }

  /**
   * Generate a unique user ID for Mem0 based on agent context
   */
  private getUserId(metadata: Pick<MemoryMetadata, "agentId">): string {
    // Use agentId as the primary identifier for Mem0
    // This ensures memories are scoped to specific agent instances
    return `browseros_agent_${metadata.agentId}`;
  }

  /**
   * Transform our metadata format to Mem0's expected format
   */
  private transformMetadataForMem0(
    metadata: MemoryMetadata
  ): Record<string, any> {
    const mem0Metadata: Record<string, any> = {};

    if (metadata.tabId) mem0Metadata.tabId = metadata.tabId.toString();
    if (metadata.taskId) mem0Metadata.taskId = metadata.taskId;
    if (metadata.category) mem0Metadata.category = metadata.category;
    if (metadata.tags) mem0Metadata.tags = metadata.tags.join(",");
    if (metadata.importance)
      mem0Metadata.importance = metadata.importance.toString();
    if (metadata.url) mem0Metadata.url = metadata.url;
    if (metadata.site) mem0Metadata.site = metadata.site;
    if (metadata.toolName) mem0Metadata.toolName = metadata.toolName;
    if (metadata.sessionId) mem0Metadata.sessionId = metadata.sessionId;

    // Add timestamp
    mem0Metadata.createdAt = new Date().toISOString();

    return mem0Metadata;
  }

  /**
   * Transform search parameters for Mem0
   */
  private transformSearchParamsForMem0(
    params: MemorySearchParams
  ): Record<string, any> {
    const searchOptions: Record<string, any> = {};

    // Build metadata filters
    const filters: Record<string, any> = {};

    if (params.category) filters.category = params.category;
    if (params.tabId) filters.tabId = params.tabId.toString();
    if (params.taskId) filters.taskId = params.taskId;
    if (params.tags && params.tags.length > 0) {
      // Mem0 might need tags as comma-separated string or array
      filters.tags = params.tags.join(",");
    }

    if (Object.keys(filters).length > 0) {
      searchOptions.filters = filters;
    }

    return searchOptions;
  }

  /**
   * Transform Mem0 results back to our MemoryEntry format
   */
  private async transformMem0ResultsToEntries(
    results: any[]
  ): Promise<MemoryEntry[]> {
    return results.map((result) => {
      const metadata: MemoryMetadata = {
        agentId: this.extractAgentIdFromUserId(result.user_id || ""),
        tabId: result.metadata?.tabId
          ? parseInt(result.metadata.tabId)
          : undefined,
        taskId: result.metadata?.taskId,
        category: result.metadata?.category as MemoryCategory,
        tags: result.metadata?.tags
          ? Array.isArray(result.metadata.tags)
            ? result.metadata.tags
            : result.metadata.tags.split(",")
          : undefined,
        importance: result.metadata?.importance
          ? parseFloat(result.metadata.importance)
          : undefined,
        url: result.metadata?.url,
        site: result.metadata?.site,
        toolName: result.metadata?.toolName,
        sessionId: result.metadata?.sessionId,
      };

      return {
        id: result.id,
        content: result.memory || result.text || "",
        metadata,
        createdAt: result.metadata?.createdAt
          ? new Date(result.metadata.createdAt)
          : new Date(),
        updatedAt: result.updatedAt ? new Date(result.updatedAt) : new Date(),
      };
    });
  }

  /**
   * Extract agent ID from Mem0 user ID
   */
  private extractAgentIdFromUserId(userId: string): string {
    return userId.replace("browseros_agent_", "") || "default";
  }
}
