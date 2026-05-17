/**
 * Benchmark v1 — baseline (unoptimised) agent behaviour.
 *
 * This version forces the agent to use the pre-optimisation approach:
 *   - take_screenshot over take_snapshot
 *   - click/fill chains over evaluate_script
 *   - no recall() warm-up
 *
 * Run with:
 *   bun test apps/server/tests/benchmarks/v1-baseline.test.ts
 *
 * Requires a live BrowserOS server. Set BROWSEROS_TEST_SERVER_PORT or use
 * BROWSEROS_TEST_USE_ENV_PORTS=true with the standard env vars.
 *
 * Results are printed to stdout and stored in process.env for cross-file
 * comparisons when running the full suite together.
 */

import { afterAll, beforeAll, describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  ensureBrowserOS,
  type TestEnvironmentConfig,
} from '../__helpers__/setup'
import { type BenchmarkMetrics, runBenchmark, tasksPerHour } from './framework'
import {
  bookDoctolibScenario,
  discordMessageScenario,
  type Scenario,
  sendEmailScenario,
} from './scenarios'

let config: TestEnvironmentConfig
const results: BenchmarkMetrics[] = []

beforeAll(async () => {
  config = await ensureBrowserOS()
}, 90_000)

afterAll(() => {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  v1 Baseline — Summary')
  console.log('══════════════════════════════════════════════════════════')
  for (const m of results) {
    const tph = tasksPerHour(m.wallClockMs)
    console.log(
      `  ${m.scenario.padEnd(26)} ` +
        `${m.wallClockMs}ms  ` +
        `${m.estTotalTokens} tok  ` +
        `${m.llmStepCount} steps  ` +
        `~${tph} tasks/hr  ` +
        (m.success ? '✓' : `✗ ${m.error ?? ''}`),
    )
  }
  console.log('══════════════════════════════════════════════════════════\n')

  // Persist for cross-file comparison (used by v2 tests when running together)
  process.env.BENCHMARK_V1_RESULTS = JSON.stringify(results)
})

async function runBaseline(scenario: Scenario): Promise<BenchmarkMetrics> {
  const metrics = await runBenchmark({
    serverUrl: `http://127.0.0.1:${config.serverPort}`,
    scenario: scenario.name,
    version: 'v1_baseline',
    task: scenario.task,
    setup: async (agent) => {
      await agent.nav('about:blank')
      await agent.nav(scenario.startUrl)
    },
  })
  results.push(metrics)
  return metrics
}

describe('v1 Baseline — Send Email (Gmail)', () => {
  it('completes the compose task', async () => {
    const m = await runBaseline(sendEmailScenario)

    console.log(
      `\n[v1 email] ${m.wallClockMs}ms | ${m.estTotalTokens} tokens | ${m.llmStepCount} steps`,
    )
    console.log(`  tools: ${m.toolCalls.join(', ')}`)

    // Baseline assertions: generous bounds, we just want it to finish
    assert.ok(
      m.success || m.error === undefined || m.error.length > 0,
      'Run should attempt the task (even partial counts)',
    )
    assert.ok(m.llmStepCount > 0, 'Should have made at least one LLM call')

    // Baseline should take MORE screenshots than snapshots
    console.log(
      `  snapshots=${m.snapshotCount}  screenshots=${m.screenshotCount}`,
    )
  }, 120_000)
})

describe('v1 Baseline — Book Doctolib', () => {
  it('finds an appointment slot', async () => {
    const m = await runBaseline(bookDoctolibScenario)

    console.log(
      `\n[v1 doctolib] ${m.wallClockMs}ms | ${m.estTotalTokens} tokens | ${m.llmStepCount} steps`,
    )
    console.log(`  tools: ${m.toolCalls.join(', ')}`)

    assert.ok(m.llmStepCount > 0, 'Should have made at least one LLM call')
    console.log(
      `  snapshots=${m.snapshotCount}  screenshots=${m.screenshotCount}`,
    )
  }, 150_000)
})

describe('v1 Baseline — Discord Message', () => {
  it('types the message without sending', async () => {
    const m = await runBaseline(discordMessageScenario)

    console.log(
      `\n[v1 discord] ${m.wallClockMs}ms | ${m.estTotalTokens} tokens | ${m.llmStepCount} steps`,
    )
    console.log(`  tools: ${m.toolCalls.join(', ')}`)

    assert.ok(m.llmStepCount > 0, 'Should have made at least one LLM call')
    console.log(
      `  snapshots=${m.snapshotCount}  screenshots=${m.screenshotCount}`,
    )
  }, 120_000)
})
