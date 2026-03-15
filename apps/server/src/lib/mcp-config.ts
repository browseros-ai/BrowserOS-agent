import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { getBrowserosDir, getMcpConfigPath } from './browseros-dir'
import { logger } from './logger'

const McpServerConfigSchema = z.object({
  url: z.string().optional(),
  description: z.string().optional(),
  transport: z.enum(['http', 'sse', 'stdio']).optional(),
  headers: z.record(z.string()).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
})

export const McpServerEntrySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  type: z.enum(['managed', 'custom']),
  managedServerName: z.string().optional(),
  managedServerDescription: z.string().optional(),
  config: McpServerConfigSchema.optional(),
})

export type McpServerEntry = z.infer<typeof McpServerEntrySchema>

const McpConfigSchema = z.object({
  version: z.literal(1),
  servers: z.array(McpServerEntrySchema),
})

type McpConfig = z.infer<typeof McpConfigSchema>

const EMPTY_CONFIG: McpConfig = { version: 1, servers: [] }

export async function readMcpConfig(): Promise<McpConfig> {
  try {
    const raw = await readFile(getMcpConfigPath(), 'utf-8')
    return McpConfigSchema.parse(JSON.parse(raw))
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_CONFIG
    logger.warn('Failed to read mcp.json, returning empty config', {
      error: error instanceof Error ? error.message : String(error),
    })
    return EMPTY_CONFIG
  }
}

async function writeMcpConfig(config: McpConfig): Promise<void> {
  const filePath = getMcpConfigPath()
  const tmpPath = join(getBrowserosDir(), `mcp.json.${Date.now()}.tmp`)
  await writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8')
  await rename(tmpPath, filePath)
}

export async function getMcpServers(): Promise<McpServerEntry[]> {
  const config = await readMcpConfig()
  return config.servers
}

export async function addMcpServer(
  server: Omit<McpServerEntry, 'id'>,
): Promise<McpServerEntry> {
  const config = await readMcpConfig()
  const entry: McpServerEntry = { ...server, id: Date.now().toString() }
  config.servers.push(entry)
  await writeMcpConfig(config)
  return entry
}

export async function updateMcpServer(
  id: string,
  patch: Partial<Omit<McpServerEntry, 'id'>>,
): Promise<McpServerEntry | null> {
  const config = await readMcpConfig()
  const index = config.servers.findIndex((s) => s.id === id)
  if (index === -1) return null

  config.servers[index] = { ...config.servers[index], ...patch, id }
  await writeMcpConfig(config)
  return config.servers[index]
}

export async function removeMcpServer(id: string): Promise<boolean> {
  const config = await readMcpConfig()
  const before = config.servers.length
  config.servers = config.servers.filter((s) => s.id !== id)
  if (config.servers.length === before) return false

  await writeMcpConfig(config)
  return true
}

export async function migrateMcpServers(
  servers: McpServerEntry[],
): Promise<number> {
  const config = await readMcpConfig()
  const existingIds = new Set(config.servers.map((s) => s.id))

  // Deduplicate by id
  let added = 0
  for (const server of servers) {
    if (!existingIds.has(server.id)) {
      config.servers.push(server)
      existingIds.add(server.id)
      added++
    }
  }

  if (added > 0) await writeMcpConfig(config)
  return added
}
