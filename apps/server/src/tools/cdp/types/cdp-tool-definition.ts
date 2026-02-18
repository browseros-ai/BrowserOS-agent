/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { PageEntry } from '../../../browser/page-registry'
import type { ImageContentData } from '../../types/response'
import {
  type ToolDefinition as BaseToolDefinition,
  commonSchemas,
  ERRORS,
  type Request,
} from '../../types/tool-definition'
import type {
  GeolocationOptions,
  TextSnapshotNode,
} from '../context/cdp-context'
import type { Dialog, ElementHandle, Page, Viewport, zod } from '../third-party'

export { type Request, commonSchemas, ERRORS }

export type { ImageContentData } from '../../types/response'

export type CdpToolDefinition<
  Schema extends zod.ZodRawShape = zod.ZodRawShape,
> = BaseToolDefinition<Schema, Context, Response> & { kind: 'cdp' }

export interface SnapshotParams {
  verbose?: boolean
  filePath?: string
}

export interface DevToolsData {
  cdpRequestId?: string
  cdpBackendNodeId?: number
}

export interface Response {
  appendResponseLine(value: string): void
  setIncludePages(value: boolean): void
  includeSnapshot(params?: SnapshotParams): void
  attachImage(value: ImageContentData): void
  attachDevToolsData(data: DevToolsData): void
  setTabId(tabId: string): void
}

export type Context = Readonly<{
  getSelectedPage(): Page
  getDialog(): Dialog | undefined
  clearDialog(): void
  getPageById(pageId: number): Page
  getPageId(page: Page): number | undefined
  isPageSelected(page: Page): boolean
  newPage(background?: boolean): Promise<Page>
  closePage(pageId: number): Promise<void>
  closePageByTabId(tabId: number): Promise<void>
  getPageByTabId(tabId: number): Page | undefined
  getPageEntry(page: Page): PageEntry | undefined
  getElementByUid(uid: string): Promise<ElementHandle<Element>>
  getAXNodeByUid(uid: string): TextSnapshotNode | undefined
  setNetworkConditions(conditions: string | null): void
  setCpuThrottlingRate(rate: number): void
  setGeolocation(geolocation: GeolocationOptions | null): void
  setViewport(viewport: Viewport | null): void
  getViewport(): Viewport | null
  setUserAgent(userAgent: string | null): void
  getUserAgent(): string | null
  setColorScheme(scheme: 'dark' | 'light' | null): void
  saveTemporaryFile(
    data: Uint8Array<ArrayBufferLike>,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  ): Promise<{ filename: string }>
  saveFile(
    data: Uint8Array<ArrayBufferLike>,
    filename: string,
  ): Promise<{ filename: string }>
  waitForEventsAfterAction(
    action: () => Promise<unknown>,
    options?: { timeout?: number },
  ): Promise<void>
  waitForTextOnPage(text: string, timeout?: number): Promise<Element>
  getDevToolsData(): Promise<DevToolsData>
  resolveCdpElementId(cdpBackendNodeId: number): string | undefined
}>

export function defineTool<Schema extends zod.ZodRawShape>(
  definition: CdpToolDefinition<Schema>,
) {
  return definition
}

export const timeoutSchema = commonSchemas.timeout

export const CLOSE_PAGE_ERROR = ERRORS.CLOSE_PAGE
