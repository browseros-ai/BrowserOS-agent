export const WS_AGENT_CONFIG = {
  // Connection
  url: process.env.WS_AGENT_URL || 'ws://localhost:3000',
  connectionTimeout: 10000,  // 10 seconds

  // Event gap timeout (matches server's EVENT_GAP_TIMEOUT_MS)
  // Client-side safety net: abort if no events received for 60s
  eventGapTimeout: 60000,  // 60 seconds

  // Reconnection
  maxReconnectAttempts: 3,
  reconnectBackoff: [1000, 2000, 4000],  // Exponential backoff in ms

  // Performance
  enableCompression: false,  // Not implemented yet
  enableScreenshots: false,  // Don't send screenshots initially
  maxResponseSize: 50000,  // 50KB

  // Security
  validateMessages: true,
  sanitizeBrowserState: true,

  // Features
  enableStreaming: true,
  enableMetrics: true,
  enableFallback: true
} as const;

export type WSAgentConfig = typeof WS_AGENT_CONFIG;
