/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * BrowserOS note:
 * `chrome-devtools-frontend` currently fails to import under Bun (e.g. locales.js
 * resolution issues). Keep all DevTools-frontend usage behind optional/lazy
 * loading so the server can start and non-DevTools-dependent tools work.
 */

import type { Browser, ConsoleMessage, Page } from './third-party'

export function extractUrlLikeFromDevToolsTitle(
  title: string,
): string | undefined {
  const match = title.match(/DevTools - (.*)/)
  return match?.[1] ?? undefined
}

export function urlsEqual(url1: string, url2: string): boolean {
  const normalizedUrl1 = normalizeUrl(url1)
  const normalizedUrl2 = normalizeUrl(url2)
  return normalizedUrl1 === normalizedUrl2
}

function normalizeUrl(url: string): string {
  let result = url.trim()

  if (result.startsWith('https://')) {
    result = result.slice(8)
  } else if (result.startsWith('http://')) {
    result = result.slice(7)
  }

  if (result.startsWith('www.')) {
    result = result.slice(4)
  }

  const hashIdx = result.lastIndexOf('#')
  if (hashIdx !== -1) {
    result = result.slice(0, hashIdx)
  }

  if (result.endsWith('/')) {
    result = result.slice(0, -1)
  }

  return result
}

export interface TargetUniverse {
  target: unknown
  universe: unknown
}

export class UniverseManager {
  constructor(_browser: Browser) {}

  async init(_pages: Page[]) {}

  dispose() {}

  get(_page: Page): TargetUniverse | null {
    return null
  }
}

export class FakeIssuesManager {}

export async function createStackTraceForConsoleMessage(
  _devTools: TargetUniverse,
  _consoleMessage: ConsoleMessage,
): Promise<undefined> {
  return undefined
}
