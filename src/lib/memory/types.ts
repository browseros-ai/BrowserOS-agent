import { z } from "zod";

/**
 * Memory Types for BrowserOS Agent
 *
 * This module defines the type system for the memory layer, supporting
 * task continuity, cross-tab context sharing, and learning capabilities.
 */

// Memory entry categories for different types of stored information
export enum MemoryCategory {
  TASK_RESULT = "task_result",
  USER_PREFERENCE = "user_preference",
  WORKFLOW_PATTERN = "workflow_pattern",
  SEARCH_RESULT = "search_result",
  INTERACTION_PATTERN = "interaction_pattern",
  ERROR_SOLUTION = "error_solution",
  RESEARCH_DATA = "research_data",
  SUCCESSFUL_PLAN = "successful_plan",
  TOOL_RESULT = "tool_result",
  CONTEXT_DATA = "context_data",
}

// Memory metadata schema with rich context information
export const MemoryMetadataSchema = z.object({
  tabId: z.number().optional(),
  agentId: z.string(),
  taskId: z.string().optional(),
  category: z.nativeEnum(MemoryCategory).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  expiresAt: z.date().optional(),
  url: z.string().optional(),
  site: z.string().optional(),
  toolName: z.string().optional(),
  sessionId: z.string().optional(),
});

// Core memory entry structure
export const MemoryEntrySchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: MemoryMetadataSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Search parameters for retrieving memories
export const MemorySearchParamsSchema = z.object({
  query: z.string(),
  category: z.nativeEnum(MemoryCategory).optional(),
  tags: z.array(z.string()).optional(),
  tabId: z.number().optional(),
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
  importance: z.number().min(0).max(1).optional(),
  timeRange: z
    .object({
      start: z.date().optional(),
      end: z.date().optional(),
    })
    .optional(),
});

// Memory statistics for UI display
export const MemoryStatsSchema = z.object({
  totalEntries: z.number(),
  entriesByCategory: z.record(z.nativeEnum(MemoryCategory), z.number()),
  tabCount: z.number(),
  lastUpdated: z.date().optional(),
  storageUsed: z.number().optional(), // in bytes
});

// User memory configuration
export const MemoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxEntries: z.number().default(1000),
  retentionDays: z.number().default(30),
  autoCleanup: z.boolean().default(true),
  importantThreshold: z.number().min(0).max(1).default(0.7),
  enableCrossTab: z.boolean().default(true),
  enableLearning: z.boolean().default(true),
});

// Export types
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;
export type MemorySearchParams = z.infer<typeof MemorySearchParamsSchema>;
export type MemoryStats = z.infer<typeof MemoryStatsSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

// Search result wrapper
export interface MemorySearchResult {
  entries: MemoryEntry[];
  total: number;
  hasMore: boolean;
}

// Memory operation results
export interface MemoryOperationResult {
  success: boolean;
  message?: string;
  data?: any;
}

// Context data for task continuation
export interface TaskContext {
  taskId: string;
  currentStep: number;
  totalSteps: number;
  intermediateResults: Record<string, any>;
  userPreferences: Record<string, any>;
  errorHistory: Array<{
    error: string;
    solution: string;
    timestamp: Date;
  }>;
}

// Agent coordination data
export interface AgentMemoryContext {
  agentId: string;
  sessionId: string;
  activeTaskId?: string;
  lastActivity: Date;
  preferences: Record<string, any>;
  learnings: Array<{
    pattern: string;
    success: boolean;
    confidence: number;
  }>;
}

