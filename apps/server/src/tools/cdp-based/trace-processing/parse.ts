/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * BrowserOS note:
 * Full trace parsing/insight generation relies on chrome-devtools-frontend, which
 * currently fails to load under Bun. Provide graceful fallbacks so the server
 * can start and tools can return actionable errors instead of crashing.
 */

import { logger } from '../logger'

export interface TraceResult {
  parsedTrace: unknown
  // biome-ignore lint/suspicious/noExplicitAny: upstream code
  insights: Map<string, any> | null
}

export interface TraceParseError {
  error: string
}

export function traceResultIsSuccess(
  x: TraceResult | TraceParseError,
): x is TraceResult {
  return 'parsedTrace' in x
}

export async function parseRawTraceBuffer(
  buffer: Uint8Array<ArrayBufferLike> | undefined,
): Promise<TraceResult | TraceParseError> {
  if (!buffer) {
    return { error: 'No buffer was provided.' }
  }

  const asString = new TextDecoder().decode(buffer)
  if (!asString) {
    return { error: 'Decoding the trace buffer returned an empty string.' }
  }

  try {
    // We can at least validate this is valid JSON, and return it as a parsed
    // object for callers that want to save/forward the raw trace data.
    const parsedTrace = JSON.parse(asString)
    return { parsedTrace, insights: null }
  } catch (e) {
    const errorText = e instanceof Error ? e.message : JSON.stringify(e)
    logger(`Unexpected error parsing trace JSON: ${errorText}`)
    return { error: errorText }
  }
}

export type InsightName = string
export type InsightOutput = { output: string } | { error: string }

export function getTraceSummary(_result: TraceResult): string {
  return `Performance trace summary is unavailable because chrome-devtools-frontend could not be loaded under Bun.`
}

export function getInsightOutput(
  _result: TraceResult,
  _insightSetId: string,
  _insightName: InsightName,
): InsightOutput {
  return {
    error:
      'Performance insights are unavailable because chrome-devtools-frontend could not be loaded under Bun.',
  }
}
