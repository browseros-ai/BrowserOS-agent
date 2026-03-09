import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { PATHS } from '@browseros/shared/constants/paths'

export function getBrowserosDir(): string {
  return join(homedir(), PATHS.BROWSEROS_DIR_NAME)
}

export function getMemoryDir(): string {
  return join(getBrowserosDir(), PATHS.MEMORY_DIR_NAME)
}

export function getSoulPath(): string {
  return join(getBrowserosDir(), PATHS.SOUL_FILE_NAME)
}

export function getCoreMemoryPath(): string {
  return join(getMemoryDir(), PATHS.CORE_MEMORY_FILE_NAME)
}

export function getMcpConfigPath(): string {
  return join(getBrowserosDir(), PATHS.MCP_CONFIG_FILE_NAME)
}

export async function ensureBrowserosDir(): Promise<void> {
  await mkdir(getMemoryDir(), { recursive: true })
}
