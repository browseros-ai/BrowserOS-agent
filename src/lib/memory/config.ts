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

  // Override with environment variables if present
  // if (process.env.MEMORY_ENABLED !== undefined) {
  //   config.enabled = process.env.MEMORY_ENABLED === "true";
  // }

  // if (process.env.MEMORY_MAX_ENTRIES) {
  //   const maxEntries = parseInt(process.env.MEMORY_MAX_ENTRIES, 10);
  //   if (!isNaN(maxEntries)) {
  //     config.maxEntries = maxEntries;
  //   }
  // }

  // if (process.env.MEMORY_RETENTION_DAYS) {
  //   const retentionDays = parseInt(process.env.MEMORY_RETENTION_DAYS, 10);
  //   if (!isNaN(retentionDays)) {
  //     config.retentionDays = retentionDays;
  //   }
  // }

  // if (process.env.MEMORY_DEBUG !== undefined) {
  //   config.debugMode = process.env.MEMORY_DEBUG === "true";
  // }

  // if (process.env.MEMORY_LOG_LEVEL) {
  //   config.logLevel = process.env.MEMORY_LOG_LEVEL as
  //     | "error"
  //     | "warn"
  //     | "info"
  //     | "debug";
  // }

  return config;
}

/**
 * Validate memory configuration
 */
export function validateMemoryConfig(config: MemoryConfig): string[] {
  const errors: string[] = [];

  if (config.enabled && !config.apiKey) {
    errors.push("MEM0_API_KEY is required when memory is enabled");
  }

  if (config.maxEntries <= 0) {
    errors.push("maxEntries must be greater than 0");
  }

  if (config.retentionDays <= 0) {
    errors.push("retentionDays must be greater than 0");
  }

  if (config.importantThreshold < 0 || config.importantThreshold > 1) {
    errors.push("importantThreshold must be between 0 and 1");
  }

  return errors;
}

/**
 * Memory system initialization status
 */
export interface MemoryInitStatus {
  initialized: boolean;
  error?: string;
  config: MemoryConfig;
  timestamp: Date;
}

/**
 * Get memory initialization instructions for users
 */
export function getMemorySetupInstructions(): string {
  return `
# Memory System Setup

To enable the memory system for your BrowserOS agent:

## 1. Get Mem0 API Key
1. Visit https://mem0.ai and create an account
2. Navigate to your dashboard and create a new API key
3. Copy the API key

## 2. Configure Environment
Add the following to your environment variables:

\`\`\`bash
# Required: Mem0 API key
MEM0_API_KEY=your_mem0_api_key_here

# Optional: Memory system configuration
MEMORY_ENABLED=true
MEMORY_MAX_ENTRIES=1000
MEMORY_RETENTION_DAYS=30
MEMORY_DEBUG=false
MEMORY_LOG_LEVEL=info
\`\`\`

## 3. Restart the Extension
After adding the environment variables, restart your browser extension.

## 4. Verify Setup
The memory system will be automatically initialized when you start using the agent.
Check the browser console for initialization messages.

## Features Enabled
- ✅ Task continuity across sessions
- ✅ Cross-tab context sharing
- ✅ User preference learning
- ✅ Successful pattern storage
- ✅ Intelligent planning with memory
- ✅ Research data persistence

## Example Usage
Your agent will now automatically:
- Remember search results when navigating between sites
- Store user preferences for future tasks
- Learn from successful interaction patterns
- Provide context-aware planning for complex tasks
`;
}
