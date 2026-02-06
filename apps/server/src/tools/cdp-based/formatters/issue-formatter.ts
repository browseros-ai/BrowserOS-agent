/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * BrowserOS note:
 * DevTools issue formatting relies on chrome-devtools-frontend, which currently
 * fails to load under Bun. This formatter is a minimal fallback.
 */

export interface IssueFormatterOptions {
  requestIdResolver?: (requestId: string) => number | undefined
  elementIdResolver?: (backendNodeId: number) => string | undefined
  id?: number
}

export class IssueFormatter {
  #issue: unknown
  #options: IssueFormatterOptions

  constructor(issue: unknown, options: IssueFormatterOptions) {
    this.#issue = issue
    this.#options = options
  }

  isValid(): boolean {
    return false
  }

  toString(): string {
    const idPart =
      this.#options.id !== undefined ? `msgid=${this.#options.id} ` : ''
    return `${idPart}[issue] <unavailable>`
  }

  toStringDetailed(): string {
    return this.toString()
  }

  toJSON(): object {
    return { issue: this.#issue, unavailable: true }
  }

  toJSONDetailed(): object {
    return this.toJSON()
  }
}
