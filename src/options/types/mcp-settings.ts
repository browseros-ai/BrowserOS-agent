import { z } from 'zod'

export const MCPToolSchema = z.object({
  name: z.string(),  // Tool name
  description: z.string()  // Tool description
})

export const MCPTestResultSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']),  // Test status
  error: z.string().optional(),  // Error message if test failed
  timestamp: z.string().optional(),  // When the test was run
  toolCount: z.number().optional(),  // Number of tools found
  tools: z.array(MCPToolSchema).optional()  // List of available tools
})

export const MCPSettingsSchema = z.object({
  enabled: z.boolean().default(false),  // Whether MCP is enabled
  serverUrl: z.string().default(''),  // MCP server URL (read-only, populated from flags)
  port: z.number().int().positive().optional()  // MCP server port
})

export type MCPTool = z.infer<typeof MCPToolSchema>
export type MCPTestResult = z.infer<typeof MCPTestResultSchema>
export type MCPSettings = z.infer<typeof MCPSettingsSchema>
