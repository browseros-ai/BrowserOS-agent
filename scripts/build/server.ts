#!/usr/bin/env bun

import { runProdResourceBuild } from './server/orchestrator'

runProdResourceBuild(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
})
