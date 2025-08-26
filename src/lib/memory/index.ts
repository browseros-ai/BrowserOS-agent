/**
 * Memory System - Main exports
 *
 * This module provides a comprehensive memory layer for the BrowserOS agent,
 * enabling task continuity, context sharing, and learning capabilities.
 */

// Core components
export { MemoryManager } from './MemoryManager';
export { Mem0ClientWrapper } from './Mem0ClientWrapper';
export { MemoryEventBus } from './MemoryEventBus';

// Import for factory functions
import { MemoryManager } from './MemoryManager';

// Types and schemas
export type { MemoryEntry, MemoryMetadata, MemorySearchParams, MemorySearchResult, MemoryOperationResult, MemoryConfig, MemoryStats, TaskContext, AgentMemoryContext, MemoryEvent } from './types';

export { MemoryCategory, MemoryEntrySchema, MemoryMetadataSchema, MemorySearchParamsSchema, MemoryStatsSchema, MemoryConfigSchema } from './types';

//tools
export { createMemoryTool } from '../tools/memory/MemoryTool';


/**
 * Factory function to create a configured MemoryManager
 */
export function createMemoryManager(
  apiKey?: string,
  config?: {
    enabled?: boolean;
    maxEntries?: number;
    retentionDays?: number;
    autoCleanup?: boolean;
    enableCrossTab?: boolean;
    enableLearning?: boolean;
  },
  agentId?: string
): MemoryManager {
  return new MemoryManager(apiKey, config, agentId);
}

/**
 * Helper function to initialize memory system
 */
export async function initializeMemorySystem(apiKey?: string, agentId?: string): Promise<MemoryManager | null> {
  try {
    const memoryManager = createMemoryManager(
      apiKey,
      {
        enabled: true,
        maxEntries: 1000,
        retentionDays: 30,
        autoCleanup: true,
        enableCrossTab: true,
        enableLearning: true
      },
      agentId
    );
    
    await memoryManager.initialize();
    return memoryManager;
  } catch (error) {
    console.warn('Failed to initialize memory system:', error);
    return null;
  }
}
