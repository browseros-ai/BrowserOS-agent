/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { LLMConfig, UIMessageStreamEvent } from '@browseros-ai/agent-sdk'
import { Agent } from '@browseros-ai/agent-sdk'
import { logger } from '../lib/logger'

export interface ExecutorOptions {
  serverUrl: string
  llmConfig?: LLMConfig
  onProgress: (event: UIMessageStreamEvent) => void
  signal?: AbortSignal
}

export interface ExecutorResult {
  success: boolean
  result?: unknown
  error?: string
}

/**
 * Executes generated graph code using the Agent SDK.
 *
 * @param code - Generated code from codegen service
 * @param sessionId - Unique session ID for this execution
 * @param tempDir - Base temp directory for execution files
 * @param options - Execution options (serverUrl, llmConfig, onProgress, signal)
 */
export async function executeGraph(
  code: string,
  sessionId: string,
  tempDir: string,
  options: ExecutorOptions,
): Promise<ExecutorResult> {
  const execDir = path.join(tempDir, 'graph', sessionId)

  try {
    // Check if aborted before starting
    if (options.signal?.aborted) {
      return { success: false, error: 'Execution aborted' }
    }

    // Create execution directory
    await mkdir(execDir, { recursive: true })

    // Transform code: remove import statements (Agent is passed directly)
    const transformedCode = transformCodeForExecution(code)

    // Write code to file
    const codePath = path.join(execDir, 'graph.ts')
    await Bun.write(codePath, transformedCode)

    logger.debug(`Wrote graph code to ${codePath}`)

    // Create Agent instance with progress callback
    const agent = new Agent({
      url: options.serverUrl,
      llm: options.llmConfig,
      onProgress: options.onProgress,
      signal: options.signal,
    })

    // Dynamic import with cache-busting (Bun caches imports by path)
    const module = await import(`${codePath}?t=${Date.now()}`)

    if (typeof module.run !== 'function') {
      throw new Error('Generated code must export a "run" function')
    }

    let abortHandler: (() => void) | undefined
    try {
      // Only use Promise.race if we have a signal to listen to
      const result = options.signal
        ? await Promise.race([
            module.run(agent),
            new Promise<never>((_, reject) => {
              abortHandler = () => reject(new Error('Execution aborted'))
              options.signal?.addEventListener('abort', abortHandler, {
                once: true,
              })
            }),
          ])
        : await module.run(agent)

      return { success: true, result }
    } finally {
      if (abortHandler && options.signal) {
        options.signal.removeEventListener('abort', abortHandler)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Graph execution failed: ${errorMessage}`)
    return { success: false, error: errorMessage }
  }
}

function transformCodeForExecution(code: string): string {
  // Remove multi-line imports: import { ... } from '@browseros-ai/agent-sdk'
  let result = code.replace(
    /^\s*import\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*['"]@browseros-ai\/agent-sdk['"].*$/gm,
    '',
  )

  // Remove single-line imports: import X from '...', import type X from '...'
  result = result.replace(
    /^\s*import\s+.*['"]@browseros-ai\/agent-sdk['"].*$/gm,
    '',
  )

  return result
}

/**
 * Cleans up execution files for a session.
 */
export async function cleanupExecution(
  sessionId: string,
  tempDir: string,
): Promise<void> {
  const execDir = path.join(tempDir, 'graph', sessionId)

  try {
    await rm(execDir, { recursive: true, force: true })
    logger.debug(`Cleaned up execution directory: ${execDir}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.warn(`Failed to cleanup execution directory: ${errorMessage}`)
  }
}
