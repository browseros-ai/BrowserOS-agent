/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Context } from 'hono'
import type { Env } from '../types'

const LOCALHOST_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const LOCALHOST_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])
const TRUSTED_EXTENSION_PROTOCOLS = new Set([
  'chrome-extension:',
  'moz-extension:',
])

/**
 * Check if request originates from localhost.
 *
 * IMPORTANT: This checks the actual TCP connection IP (req.socket.remoteAddress equivalent)
 * which CANNOT be spoofed, unlike HTTP headers like Host or X-Forwarded-For.
 *
 * In Bun.serve, we use server.requestIP() to get the real client IP.
 *
 * @param c - Hono context with Bun server binding
 * @returns true if request is from localhost, false otherwise
 */
export function isLocalhostRequest(c: Context<Env>): boolean {
  const server = c.env.server
  const request = c.req.raw

  // 1. CHECK ACTUAL TCP CONNECTION IP (cannot be spoofed)
  const socketAddr = server.requestIP(request)
  if (!socketAddr || !LOCALHOST_ADDRESSES.has(socketAddr.address)) {
    return false
  }

  // 2. Also check Host header (defense in depth)
  const host = c.req.header('host')
  if (!host) return false
  const hostname = host.split(':')[0]
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') return false

  // 3. Check referer if present (defense in depth)
  const referer = c.req.header('referer')
  if (referer) {
    try {
      const url = new URL(referer)
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

function isTrustedRequestUrl(urlValue: string | undefined): boolean {
  if (!urlValue) return true

  try {
    const url = new URL(urlValue)
    return (
      LOCALHOST_HOSTNAMES.has(url.hostname) ||
      TRUSTED_EXTENSION_PROTOCOLS.has(url.protocol)
    )
  } catch {
    return false
  }
}

export function isTrustedLocalBrowserRequest(c: Context<Env>): boolean {
  const server = c.env.server
  const request = c.req.raw
  const socketAddr = server.requestIP(request)
  if (!socketAddr || !LOCALHOST_ADDRESSES.has(socketAddr.address)) {
    return false
  }

  const host = c.req.header('host')
  if (!host) return false
  const hostname = host.split(':')[0]
  if (!LOCALHOST_HOSTNAMES.has(hostname)) return false

  return (
    isTrustedRequestUrl(c.req.header('origin')) &&
    isTrustedRequestUrl(c.req.header('referer'))
  )
}
