#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * BrowserOS Server - Entry Point
 */

// Runtime check for Bun
if (typeof Bun === 'undefined') {
  console.error('Error: This application requires Bun runtime.')
  console.error(
    'Please install Bun from https://bun.sh and run with: bun src/index.ts',
  )
  process.exit(1)
}

// Import polyfills first
import './common/polyfill'
import { CommanderError } from 'commander'
import { Sentry } from './common/sentry/instrument'
import { loadServerConfig } from './config'
import { Application } from './main'

const configResult = loadServerConfig()

if (!configResult.ok) {
  Sentry.captureException(new Error(configResult.error))
  console.error(configResult.error)
  process.exit(1)
}

const app = new Application(configResult.value)

try {
  await app.start()
} catch (error) {
  if (error instanceof CommanderError) {
    process.exit(error.exitCode)
  }
  Sentry.captureException(error)
  console.error('Failed to start server:', error)
  process.exit(1)
}

process.on('SIGINT', () => app.stop())
process.on('SIGTERM', () => app.stop())
