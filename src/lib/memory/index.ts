/**
 * Memory System - Main exports
 *
 * This module provides a comprehensive memory layer for the BrowserOS agent,
 * enabling task continuity, context sharing, and learning capabilities.
 */

// Core components
export { MemoryManager } from './MemoryManager';
export { Mem0ClientWrapper } from './Mem0ClientWrapper';
import { Logging } from '@/lib/utils/Logging'

// Import for factory functions
import { MemoryManager } from './MemoryManager';
import { getMemoryConfig } from './config';

// Types and schemas
export type { MemoryEntry, MemoryMetadata, MemorySearchParams, MemorySearchResult, MemoryOperationResult, MemoryConfig, MemoryStats, TaskContext, AgentMemoryContext } from './types';

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
    const memoryConfig = getMemoryConfig();

    if (!memoryConfig.enabled) {
      Logging.log('MemorySystem', 'Memory system is disabled via MEMORY_ENABLED environment variable');
      return null;
    }

    const effectiveApiKey = apiKey || memoryConfig.apiKey;
    
    if (!effectiveApiKey) {
      Logging.log('MemorySystem', 'Memory system disabled: No API key provided and MEM0_API_KEY not set');
      return null;
    }

    const memoryManager = createMemoryManager(
      effectiveApiKey,
      {
        enabled: memoryConfig.enabled,
        maxEntries: memoryConfig.maxEntries,
        retentionDays: memoryConfig.retentionDays,
        autoCleanup: memoryConfig.autoCleanup,
        enableCrossTab: memoryConfig.enableCrossTab,
        enableLearning: memoryConfig.enableLearning
      },
      agentId
    );
    
    await memoryManager.initialize();
    Logging.log('MemorySystem', 'Memory system initialized successfully');
    return memoryManager;
  } catch (error) {
    Logging.log('MemorySystem', `Failed to initialize memory system: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}
