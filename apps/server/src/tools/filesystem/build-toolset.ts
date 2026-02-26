import type { ToolSet } from 'ai'
import { createBashTool } from './bash'
import { createEditTool } from './edit'
import { createFindTool } from './find'
import { createGrepTool } from './grep'
import { createLsTool } from './ls'
import { createReadTool } from './read'
import { createWriteTool } from './write'

export function buildFilesystemToolSet(cwd: string): ToolSet {
  return {
    filesystem_read: createReadTool(cwd),
    filesystem_write: createWriteTool(cwd),
    filesystem_edit: createEditTool(cwd),
    filesystem_bash: createBashTool(cwd),
    filesystem_grep: createGrepTool(cwd),
    filesystem_find: createFindTool(cwd),
    filesystem_ls: createLsTool(cwd),
  }
}
