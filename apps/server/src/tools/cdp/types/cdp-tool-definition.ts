/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ImageContentData } from '../../types/response'
import {
  type ToolDefinition as BaseToolDefinition,
  commonSchemas,
  ERRORS,
  type Request,
} from '../../types/tool-definition'
import type { zod } from '../third-party'
import type { CdpToolContext } from './cdp-tool-context'

export { type Request, commonSchemas, ERRORS }

export type { ImageContentData } from '../../types/response'

export type CdpToolDefinition<
  Schema extends zod.ZodRawShape = zod.ZodRawShape,
> = BaseToolDefinition<Schema, CdpToolContext, Response> & { kind: 'cdp' }

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
  addStructuredContent(key: string, value: unknown): void
  setIncludePages(value: boolean): void
  includeSnapshot(params?: SnapshotParams): void
  attachImage(value: ImageContentData): void
  attachDevToolsData(data: DevToolsData): void
  resetResponseLineForTesting?(): void
}

export function defineTool<Schema extends zod.ZodRawShape>(
  definition: CdpToolDefinition<Schema>,
) {
  return definition
}

export const timeoutSchema = commonSchemas.timeout

export const CLOSE_PAGE_ERROR = ERRORS.CLOSE_PAGE
