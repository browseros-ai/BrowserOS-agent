/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shared Browser Context Zod schemas - single source of truth.
 * Use z.infer<> for TypeScript types.
 */

import { z } from 'zod'

/**
 * Tab information schema
 */
export const TabSchema: z.ZodObject<{
  id: z.ZodNumber
  url: z.ZodOptional<z.ZodString>
  title: z.ZodOptional<z.ZodString>
  pageId: z.ZodOptional<z.ZodNumber>
}> = z.object({
  id: z.number(),
  url: z.string().optional(),
  title: z.string().optional(),
  pageId: z.number().optional(),
})

export type Tab = z.infer<typeof TabSchema>

/**
 * Custom MCP server configuration schemas — one variant per transport type
 */
const HttpMcpServerSchema = z.object({
  transport: z.literal('http'),
  name: z.string(),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
})

const SseMcpServerSchema = z.object({
  transport: z.literal('sse'),
  name: z.string(),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
})

const StdioMcpServerSchema = z.object({
  transport: z.literal('stdio'),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
})

export const CustomMcpServerSchema = z.discriminatedUnion('transport', [
  HttpMcpServerSchema,
  SseMcpServerSchema,
  StdioMcpServerSchema,
])

export type CustomMcpServer = z.infer<typeof CustomMcpServerSchema>

/**
 * Browser context schema
 * Contains window, tab, and MCP server information for targeting browser operations
 */
export const BrowserContextSchema = z.object({
  windowId: z.number().optional(),
  activeTab: TabSchema.optional(),
  selectedTabs: z.array(TabSchema).optional(),
  tabs: z.array(TabSchema).optional(),
  enabledMcpServers: z.array(z.string()).optional(),
  customMcpServers: z.array(CustomMcpServerSchema).optional(),
})

export type BrowserContext = z.infer<typeof BrowserContextSchema>
