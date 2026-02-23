import type { Browser } from '../browser/browser'

export type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export type PostAction =
  | { type: 'snapshot'; page: number }
  | { type: 'screenshot'; page: number }

export interface ToolResult {
  content: ContentItem[]
  isError?: boolean
}

export class ToolResponse {
  private content: ContentItem[] = []
  private hasError = false
  private postActions: PostAction[] = []

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

  includeSnapshot(page: number): void {
    this.postActions.push({ type: 'snapshot', page })
  }

  includeScreenshot(page: number): void {
    this.postActions.push({ type: 'screenshot', page })
  }

  // Resolve post-actions and append additional context to the response
  async build(browser: Browser): Promise<ToolResult> {
    for (const action of this.postActions) {
      try {
        switch (action.type) {
          case 'snapshot': {
            // Accessibility tree for the page
            const tree = await browser.snapshot(action.page)
            if (tree) this.text(`[Page ${action.page} snapshot]\n${tree}`)
            break
          }
          case 'screenshot': {
            // PNG screenshot of the visible viewport
            const result = await browser.screenshot(action.page, {
              format: 'png',
              fullPage: false,
            })
            this.text(`[Page ${action.page} screenshot]`)
            this.image(result.data, result.mimeType)
            break
          }
        }
      } catch {
        // Post-action failure doesn't fail the tool
      }
    }
    return this.toResult()
  }

  toResult(): ToolResult {
    return {
      content: this.content,
      ...(this.hasError && { isError: true }),
    }
  }
}
