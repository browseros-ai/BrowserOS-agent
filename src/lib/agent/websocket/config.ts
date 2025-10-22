import { z } from "zod";

export const WSAgentConfigSchema = z.object({
  url: z.string().url(),  // Fallback URL if BrowserOS preference not available
  connectionTimeout: z.number().int().positive(),  // Connection timeout in ms
  eventGapTimeout: z.number().int().positive(),  // Event gap timeout in ms (matches server's EVENT_GAP_TIMEOUT_MS)
  maxReconnectAttempts: z.number().int().positive(),  // Maximum reconnection attempts
  reconnectBackoff: z.array(z.number().int().positive()),  // Exponential backoff in ms
  enableCompression: z.boolean(),  // Enable compression (not implemented yet)
  enableScreenshots: z.boolean(),  // Send screenshots to server
  maxResponseSize: z.number().int().positive(),  // Maximum response size in bytes
  validateMessages: z.boolean(),  // Validate incoming messages
  sanitizeBrowserState: z.boolean(),  // Sanitize browser state before sending
  enableStreaming: z.boolean(),  // Enable streaming responses
  enableMetrics: z.boolean(),  // Enable metrics collection
  enableFallback: z.boolean()  // Enable fallback to local agent on failure
});

export type WSAgentConfig = z.infer<typeof WSAgentConfigSchema>;

export const WS_AGENT_CONFIG: WSAgentConfig = {
  url: 'ws://localhost:3000',
  connectionTimeout: 10000,
  eventGapTimeout: 60000,
  maxReconnectAttempts: 3,
  reconnectBackoff: [1000, 2000, 4000],
  enableCompression: false,
  enableScreenshots: false,
  maxResponseSize: 50000,
  validateMessages: true,
  sanitizeBrowserState: true,
  enableStreaming: true,
  enableMetrics: true,
  enableFallback: true
};
