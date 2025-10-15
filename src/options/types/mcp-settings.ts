import { z } from 'zod'

export const MCPTestResultSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']),  // Test status
  error: z.string().optional(),  // Error message if test failed
  timestamp: z.string().optional()  // When the test was run
})

export const MCPSettingsSchema = z.object({
  enabled: z.boolean().default(false),  // Whether MCP is enabled
  serverUrl: z.string().default(''),  // MCP server URL (read-only, populated from flags)
  port: z.number().int().positive().optional()  // MCP server port
})

export type MCPTestResult = z.infer<typeof MCPTestResultSchema>
export type MCPSettings = z.infer<typeof MCPSettingsSchema>
