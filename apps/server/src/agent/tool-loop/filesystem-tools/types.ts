import type { z } from 'zod'

export type FilesystemContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export interface FilesystemToolResult {
  content: FilesystemContentItem[]
  isError?: boolean
}

export interface FilesystemTool<TInput = unknown> {
  name: string
  description: string
  inputSchema: z.ZodType<TInput>
  execute: (input: TInput, cwd: string) => Promise<FilesystemToolResult>
}
