import type { ToolSet } from 'ai'
import { createReadCoreTool } from './read-core'
import { createSaveCoreTool } from './save-core'
import { createMemorySearchTool } from './search'
import { createMemoryWriteTool } from './write'

export function buildMemoryToolSet(): ToolSet {
  return {
    memory_search: createMemorySearchTool(),
    memory_write: createMemoryWriteTool(),
    memory_read_core: createReadCoreTool(),
    memory_save_core: createSaveCoreTool(),
  }
}
