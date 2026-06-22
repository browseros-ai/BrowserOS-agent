/**
 * Standalone benchmark runner for a remote / pre-running BrowserOS server.
 *
 * Bypasses ensureBrowserOS() (which tries to spawn a local binary) and connects
 * directly to the given server URL.
 *
 * Usage:
 *   bun run apps/server/tests/benchmarks/run-on-remote.ts
 *   bun run apps/server/tests/benchmarks/run-on-remote.ts --url http://localhost:9204
 *   bun run apps/server/tests/benchmarks/run-on-remote.ts --scenario send-email-gmail
 *   bun run apps/server/tests/benchmarks/run-on-remote.ts --v1-only
 *   bun run apps/server/tests/benchmarks/run-on-remote.ts --v2-only
 */

import {
  type BenchmarkMetrics,
  printComparison,
  runBenchmark,
  tasksPerHour,
} from './framework'
import { ALL_SCENARIOS, type Scenario } from './scenarios'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const SERVER_URL = getArg('--url', 'http://localhost:9204')
const scenarioFilter = getArg('--scenario', '')
const v1Only = args.includes('--v1-only')
const v2Only = args.includes('--v2-only')

const runV1 = !v2Only
const runV2 = !v1Only

// ---------------------------------------------------------------------------
// Server health check
// ---------------------------------------------------------------------------

async function assertServerReady(url: string): Promise<void> {
  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as {
      status: string
      cdpConnected?: boolean
    }
    if (body.status !== 'ok') throw new Error(`status=${body.status}`)

    const statusRes = await fetch(`${url}/status`, {
      signal: AbortSignal.timeout(5_000),
    })
    const statusBody = (await statusRes.json()) as {
      extensionConnected?: boolean
    }

    console.log(
      `✓ Server ready  CDP=${body.cdpConnected ?? '?'}  Extension=${statusBody.extensionConnected ?? '?'}`,
    )
  } catch (err) {
    console.error(`✗ Server not reachable at ${url}: ${err}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Run one scenario as both versions and print comparison
// ---------------------------------------------------------------------------

async function benchmarkScenario(
  scenario: Scenario,
  serverUrl: string,
): Promise<{ v1?: BenchmarkMetrics; v2?: BenchmarkMetrics }> {
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  Scenario: ${scenario.name}`)
  console.log(`  Task:     ${scenario.task.slice(0, 80)}…`)
  console.log(`${'═'.repeat(64)}`)

  const opts = {
    serverUrl,
    scenario: scenario.name,
    task: scenario.task,
    setup: async (agent: { nav(url: string): Promise<unknown> }) => {
      // Navigate to blank first to close any leftover compose windows / modals
      // from previous runs, then load the real start URL fresh.
      await agent.nav('about:blank')
      await agent.nav(scenario.startUrl)
    },
  }

  let v1: BenchmarkMetrics | undefined
  let v2: BenchmarkMetrics | undefined

  if (runV1) {
    console.log('\n  Running v1 baseline…')
    v1 = await runBenchmark({ ...opts, version: 'v1_baseline' })
    const tph = tasksPerHour(v1.wallClockMs)
    console.log(
      `  v1: ${v1.wallClockMs}ms | ${v1.estTotalTokens} tok | ${v1.llmStepCount} steps | ~${tph} tasks/hr | ${v1.success ? '✓' : `✗ ${v1.error ?? ''}`}`,
    )
    console.log(`      tools: ${v1.toolCalls.join(', ')}`)
  }

  if (runV2) {
    console.log('\n  Running v2 optimised…')
    v2 = await runBenchmark({ ...opts, version: 'v2_optimized' })
    const tph = tasksPerHour(v2.wallClockMs)
    console.log(
      `  v2: ${v2.wallClockMs}ms | ${v2.estTotalTokens} tok | ${v2.llmStepCount} steps | ~${tph} tasks/hr | ${v2.success ? '✓' : `✗ ${v2.error ?? ''}`}`,
    )
    console.log(`      tools: ${v2.toolCalls.join(', ')}`)
  }

  if (v1 && v2) printComparison(v1, v2)

  return { v1, v2 }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nBrowserOS Benchmark Runner`)
  console.log(`Server: ${SERVER_URL}`)
  console.log(
    `Versions: ${[runV1 && 'v1_baseline', runV2 && 'v2_optimized'].filter(Boolean).join(', ')}`,
  )

  await assertServerReady(SERVER_URL)

  const scenarios = scenarioFilter
    ? ALL_SCENARIOS.filter((s) => s.name.includes(scenarioFilter))
    : ALL_SCENARIOS

  if (scenarios.length === 0) {
    console.error(
      `No scenarios matching "${scenarioFilter}". Available: ${ALL_SCENARIOS.map((s) => s.name).join(', ')}`,
    )
    process.exit(1)
  }

  const allV1: BenchmarkMetrics[] = []
  const allV2: BenchmarkMetrics[] = []

  for (const scenario of scenarios) {
    const { v1, v2 } = await benchmarkScenario(scenario, SERVER_URL)
    if (v1) allV1.push(v1)
    if (v2) allV2.push(v2)
  }

  // Overall summary
  console.log(`\n${'═'.repeat(64)}`)
  console.log('  Overall Summary')
  console.log(`${'═'.repeat(64)}`)

  const totalMs = (arr: BenchmarkMetrics[]) =>
    arr.reduce((s, m) => s + m.wallClockMs, 0)
  const totalTok = (arr: BenchmarkMetrics[]) =>
    arr.reduce((s, m) => s + m.estTotalTokens, 0)
  const totalSteps = (arr: BenchmarkMetrics[]) =>
    arr.reduce((s, m) => s + m.llmStepCount, 0)

  if (runV1 && allV1.length) {
    console.log(
      `  v1 baseline:  ${totalMs(allV1)}ms total | ${totalTok(allV1)} tokens | ${totalSteps(allV1)} steps`,
    )
  }
  if (runV2 && allV2.length) {
    console.log(
      `  v2 optimised: ${totalMs(allV2)}ms total | ${totalTok(allV2)} tokens | ${totalSteps(allV2)} steps`,
    )
  }
  if (allV1.length && allV2.length) {
    const msGain = ((1 - totalMs(allV2) / totalMs(allV1)) * 100).toFixed(1)
    const tokGain = ((1 - totalTok(allV2) / totalTok(allV1)) * 100).toFixed(1)
    console.log(`  Speed gain:   ${msGain}%`)
    console.log(`  Token gain:   ${tokGain}%`)
  }
  console.log(`${'═'.repeat(64)}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
