/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * HMAC authentication for codegen service requests.
 */

import { createHmac } from 'node:crypto'

export interface CodegenAuthConfig {
  hmacSecret: string
  userId: string
}

export interface CodegenAuthHeaders {
  'X-BrowserOS-User-Id': string
  'X-BrowserOS-Timestamp': string
  'X-BrowserOS-Signature': string
}

/**
 * Compute HMAC-SHA256 signature for codegen service authentication.
 *
 * Signature format: HMAC-SHA256(secret, "${METHOD}:${PATH}:${TIMESTAMP}:${USER_ID}:${BODY}")
 */
export function computeCodegenSignature(
  hmacSecret: string,
  method: string,
  path: string,
  timestamp: string,
  userId: string,
  body: string,
): string {
  const message = `${method}:${path}:${timestamp}:${userId}:${body}`
  return createHmac('sha256', hmacSecret).update(message).digest('hex')
}

/**
 * Create authentication headers for codegen service requests.
 *
 * @param config - Auth configuration with hmacSecret and userId
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param path - Request path (e.g., '/api/code', '/api/code/abc123')
 * @param body - Request body as string (empty string for GET requests)
 * @returns Headers object with authentication headers
 */
export function createCodegenAuthHeaders(
  config: CodegenAuthConfig,
  method: string,
  path: string,
  body: string = '',
): CodegenAuthHeaders {
  const timestamp = Date.now().toString()
  const signature = computeCodegenSignature(
    config.hmacSecret,
    method,
    path,
    timestamp,
    config.userId,
    body,
  )

  return {
    'X-BrowserOS-User-Id': config.userId,
    'X-BrowserOS-Timestamp': timestamp,
    'X-BrowserOS-Signature': signature,
  }
}

/**
 * Extract the path from a full URL for signature computation.
 */
export function extractPathFromUrl(url: string): string {
  const urlObj = new URL(url)
  return urlObj.pathname
}
