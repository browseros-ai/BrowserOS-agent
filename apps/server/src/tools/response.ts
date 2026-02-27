import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import type { Browser } from '../browser/browser'

export type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export type PostAction =
  | { type: 'snapshot'; page: number }
  | { type: 'screenshot'; page: number }
  | { type: 'pages' }

export interface ToolResult {
  content: ContentItem[]
  isError?: boolean
}

interface ToolResponseOptions {
  postActionTimeoutMs?: number
}

export class ToolResponse {
  private content: ContentItem[] = []
  private hasError = false
  private postActions: PostAction[] = []
  private postActionTimeoutMs: number

  constructor(options: ToolResponseOptions = {}) {
    this.postActionTimeoutMs =
      options.postActionTimeoutMs ?? TIMEOUTS.TOOL_POST_ACTION
  }

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

  includePages(): void {
    this.postActions.push({ type: 'pages' })
  }

  private async runPostAction(
    action: PostAction,
    browser: Browser,
  ): Promise<void> {
    switch (action.type) {
      case 'snapshot': {
        const tree = await browser.snapshot(action.page)
        if (tree) this.text(`[Page ${action.page} snapshot]\n${tree}`)
        return
      }
      case 'screenshot': {
        const result = await browser.screenshot(action.page, {
          format: 'png',
          fullPage: false,
        })
        this.text(`[Page ${action.page} screenshot]`)
        this.image(result.data, result.mimeType)
        return
      }
      case 'pages': {
        const pages = await browser.listPages()
        if (pages.length === 0) {
          this.text('[Open pages] None')
        } else {
          const lines = pages.map(
            (p) =>
              `  ${p.pageId}. ${p.title || '(untitled)'} — ${p.url}${p.isActive ? ' [ACTIVE]' : ''}`,
          )
          this.text(`[Open pages]\n${lines.join('\n')}`)
        }
      }
    }
  }

  private async withTimeout<T>(task: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        task,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Post-action timed out'))
          }, this.postActionTimeoutMs)
        }),
      ])
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  async build(browser: Browser): Promise<ToolResult> {
    if (this.postActions.length > 0) {
      this.text('\n--- Additional context (auto-included) ---')
    }

    for (const action of this.postActions) {
      try {
        await this.withTimeout(this.runPostAction(action, browser))
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
