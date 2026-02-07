/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js'

export interface ImageContentData {
  data: string
  mimeType: string
}

export interface ToolResult {
  content: Array<TextContent | ImageContent>
  structuredContent: Record<string, unknown>
}
