/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import fs from 'node:fs'

import { debug } from './third-party'

const mcpDebugNamespace = 'mcp:log'

const namespacesToEnable = [
  mcpDebugNamespace,
  ...(process.env.DEBUG ? [process.env.DEBUG] : []),
]

export function saveLogsToFile(fileName: string): fs.WriteStream {
  // Enable overrides everything so we need to add them
  debug.enable(namespacesToEnable.join(','))

  const logFile = fs.createWriteStream(fileName, { flags: 'a+' })
  // biome-ignore lint/suspicious/noExplicitAny: upstream code
  debug.log = (...chunks: any[]) => {
    logFile.write(`${chunks.join(' ')}\n`)
  }
  logFile.on('error', (error) => {
    console.error(`Error when opening/writing to log file: ${error.message}`)
    logFile.end()
    process.exit(1)
  })
  return logFile
}

export function flushLogs(
  logFile: fs.WriteStream,
  timeoutMs = 2000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(reject, timeoutMs)
    logFile.end(() => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

export const logger = debug(mcpDebugNamespace)
