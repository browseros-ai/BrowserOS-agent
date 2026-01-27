/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type { Browser, ConnectOptions, Target } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'

let browser: Browser | undefined

const ignoredPrefixes = new Set([
  'chrome://',
  'chrome-extension://',
  'chrome-untrusted://',
  'devtools://',
])

function targetFilter(target: Target): boolean {
  if (target.url() === 'chrome://newtab/') {
    return true
  }
  for (const prefix of ignoredPrefixes) {
    if (target.url().startsWith(prefix)) {
      return false
    }
  }
  return true
}

const connectOptions: ConnectOptions = {
  targetFilter,
}

/**
 * Connect to an existing browser instance via CDP.
 * Always connects, never launches.
 * Times out after 5 seconds if CDP is not available.
 */
export async function ensureBrowserConnected(
  browserURL: string,
): Promise<Browser> {
  if (browser?.connected) {
    return browser
  }

  // Add timeout to prevent hanging if CDP is not available
  const timeoutMs = 5000
  const connectPromise = puppeteer.connect({
    ...connectOptions,
    browserURL,
    defaultViewport: null,
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`CDP connection timeout after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })

  browser = await Promise.race([connectPromise, timeoutPromise])
  return browser
}
