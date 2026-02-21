export type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export interface ToolResult {
  content: ContentItem[]
  isError?: boolean
}

export class ToolResponse {
  private content: ContentItem[] = []
  private hasError = false

  text(value: string): void {
    this.content.push({ type: 'text', text: value })
  }

  image(data: string, mimeType: string): void {
    this.content.push({ type: 'image', data, mimeType })
  }

  error(message: string): void {
    this.hasError = true
    this.content.push({ type: 'text', text: message })
  }

  includeSnapshot(_tabId: number): void {
    // no-op for now — will be wired to actual snapshot fetching later
  }

  toResult(): ToolResult {
    return {
      content: this.content,
      ...(this.hasError && { isError: true }),
    }
  }
}
