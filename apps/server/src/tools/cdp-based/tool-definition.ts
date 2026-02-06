/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ToolCategories } from '../types/tool-categories'
import { commonSchemas, ERRORS, type Request } from '../types/tool-definition'
import type { GeolocationOptions, TextSnapshotNode } from './context'
import type { InstalledExtension } from './extension-registry'
import type { Dialog, ElementHandle, Page, Viewport, zod } from './third-party'
import type { InsightName, TraceResult } from './trace-processing/parse'
import type { PaginationOptions } from './utils/types'

export { type Request, commonSchemas, ERRORS }

export interface ToolDefinition<
  Schema extends zod.ZodRawShape = zod.ZodRawShape,
> {
  name: string
  description: string
  kind: 'cdp'
  annotations: {
    title?: string
    category: ToolCategories | string
    readOnlyHint: boolean
    conditions?: string[]
  }
  schema: Schema
  handler: (
    request: Request<Schema>,
    response: Response,
    context: Context,
  ) => Promise<void>
}

export interface ImageContentData {
  data: string
  mimeType: string
}

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
  setIncludeNetworkRequests(
    value: boolean,
    options?: PaginationOptions & {
      resourceTypes?: string[]
      includePreservedRequests?: boolean
      networkRequestIdInDevToolsUI?: number
    },
  ): void
  setIncludeConsoleData(
    value: boolean,
    options?: PaginationOptions & {
      types?: string[]
      includePreservedMessages?: boolean
    },
  ): void
  includeSnapshot(params?: SnapshotParams): void
  attachImage(value: ImageContentData): void
  attachNetworkRequest(
    reqid: number,
    options?: { requestFilePath?: string; responseFilePath?: string },
  ): void
  attachConsoleMessage(msgid: number): void
  attachDevToolsData(data: DevToolsData): void
  setTabId(tabId: string): void
  attachTraceSummary(trace: TraceResult): void
  attachTraceInsight(
    trace: TraceResult,
    insightSetId: string,
    insightName: InsightName,
  ): void
  setListExtensions(): void
}

export type Context = Readonly<{
  isRunningPerformanceTrace(): boolean
  setIsRunningPerformanceTrace(x: boolean): void
  recordedTraces(): TraceResult[]
  storeTraceRecording(result: TraceResult): void
  getSelectedPage(): Page
  getDialog(): Dialog | undefined
  clearDialog(): void
  getPageById(pageId: number): Page
  getPageId(page: Page): number | undefined
  isPageSelected(page: Page): boolean
  newPage(background?: boolean): Promise<Page>
  closePage(pageId: number): Promise<void>
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
  resolveCdpRequestId(cdpRequestId: string): number | undefined
  resolveCdpElementId(cdpBackendNodeId: number): string | undefined
  installExtension(path: string): Promise<string>
  uninstallExtension(id: string): Promise<void>
  listExtensions(): InstalledExtension[]
  getExtension(id: string): InstalledExtension | undefined
}>

export function defineTool<Schema extends zod.ZodRawShape>(
  definition: ToolDefinition<Schema>,
) {
  return definition
}

export const timeoutSchema = commonSchemas.timeout

export const CLOSE_PAGE_ERROR = ERRORS.CLOSE_PAGE
