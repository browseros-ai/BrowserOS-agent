/**
 * Memory Configuration
 *
 * This file contains configuration for the memory system including
 * API keys, settings, and initialization parameters.
 */

/**
 * Memory configuration interface
 */
export interface MemoryConfig {
  // Mem0 API configuration
  apiKey?: string;

  // Memory system settings
  enabled: boolean;
  maxEntries: number;
  retentionDays: number;
  autoCleanup: boolean;
  importantThreshold: number;
  enableCrossTab: boolean;
  enableLearning: boolean;

  // Debug settings
  debugMode: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  maxEntries: 1000,
  retentionDays: 30,
  autoCleanup: true,
  importantThreshold: 0.7,
  enableCrossTab: true,
  enableLearning: true,
  debugMode: false,
  logLevel: "info",
};

/**
 * Get memory configuration from environment and defaults
 */
export function getMemoryConfig(): MemoryConfig {
  const config: MemoryConfig = { ...DEFAULT_MEMORY_CONFIG };

  // Try to get API key from environment
  config.apiKey = process.env.MEM0_API_KEY;


  return config;
}