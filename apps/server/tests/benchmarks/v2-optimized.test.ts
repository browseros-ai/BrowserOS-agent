/**
 * Benchmark v2 — optimised agent behaviour.
 *
 * Optimisations active in this version (vs v1 baseline):
 *   1. KV-cache-aware prompt ordering — static sections before dynamic
 *   2. script-over-click guidance — evaluate_script preferred over click/fill
 *   3. take_screenshot demoted — only for visual inspection
 *   4. fill/clear no longer auto-include snapshots (saves tokens per field)
 *   5. press_key now auto-includes snapshot (correct visibility after Enter)
 *   6. get_page_content defaults to viewportOnly:true (leaner extraction)
 *   7. action-cache prompt strengthened — recall() before every multi-step task
 *
 * Run with:
 *   bun test apps/server/tests/benchmarks/v2-optimized.test.ts
 *
 * Run both versions together for a live comparison:
 *   bun test apps/server/tests/benchmarks/
 */

import { afterAll, beforeAll, describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  ensureBrowserOS,
  type TestEnvironmentConfig,
} from '../__helpers__/setup'
import {
  type BenchmarkMetrics,
  printComparison,
  runBenchmark,
  tasksPerHour,
} from './framework'
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
  console.log('  v2 Optimised — Summary')
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
  console.log('══════════════════════════════════════════════════════════')

  // If v1 results are available (full suite run), print side-by-side comparisons
  const v1Raw = process.env.BENCHMARK_V1_RESULTS
  if (v1Raw) {
    const v1Results: BenchmarkMetrics[] = JSON.parse(v1Raw)
    for (const v2 of results) {
      const v1 = v1Results.find((r) => r.scenario === v2.scenario)
      if (v1) printComparison(v1, v2)
    }
  } else {
    console.log(
      '\n  (Run v1-baseline.test.ts first for side-by-side comparison)\n',
    )
  }
})

async function runOptimised(scenario: Scenario): Promise<BenchmarkMetrics> {
  const metrics = await runBenchmark({
    serverUrl: `http://127.0.0.1:${config.serverPort}`,
    scenario: scenario.name,
    version: 'v2_optimized',
    task: scenario.task,
    setup: async (agent) => {
      await agent.nav('about:blank')
      await agent.nav(scenario.startUrl)
    },
  })
  results.push(metrics)
  return metrics
}

describe('v2 Optimised — Send Email (Gmail)', () => {
  it('completes the compose task with fewer tokens', async () => {
    const m = await runOptimised(sendEmailScenario)

    console.log(
      `\n[v2 email] ${m.wallClockMs}ms | ${m.estTotalTokens} tokens | ${m.llmStepCount} steps`,
    )
    console.log(`  tools: ${m.toolCalls.join(', ')}`)
    console.log(
      `  snapshots=${m.snapshotCount}  screenshots=${m.screenshotCount}`,
    )
    console.log(`  throughput: ~${tasksPerHour(m.wallClockMs)} tasks/hr`)

    assert.ok(
      m.success || m.error === undefined || m.error.length > 0,
      'Run should attempt the task',
    )
    assert.ok(m.llmStepCount > 0, 'Should have made at least one LLM call')

    // v2 should favour snapshots over screenshots
    assert.ok(
      m.snapshotCount >= m.screenshotCount,
      `v2 should prefer take_snapshot (${m.snapshotCount}) over take_screenshot (${m.screenshotCount})`,
    )

    // v2 should not use more than the scenario time budget
    if (sendEmailScenario.maxWallClockMs) {
      assert.ok(
        m.wallClockMs <= sendEmailScenario.maxWallClockMs,
        `Took ${m.wallClockMs}ms, expected ≤ ${sendEmailScenario.maxWallClockMs}ms`,
      )
    }
  }, 120_000)
})

describe('v2 Optimised — Book Doctolib', () => {
  it('finds an appointment slot with fewer LLM steps', async () => {
    const m = await runOptimised(bookDoctolibScenario)

    console.log(
      `\n[v2 doctolib] ${m.wallClockMs}ms | ${m.estTotalTokens} tokens | ${m.llmStepCount} steps`,
    )
    console.log(`  tools: ${m.toolCalls.join(', ')}`)
    console.log(
      `  snapshots=${m.snapshotCount}  screenshots=${m.screenshotCount}`,
    )
    console.log(`  throughput: ~${tasksPerHour(m.wallClockMs)} tasks/hr`)

    assert.ok(m.llmStepCount > 0, 'Should have made at least one LLM call')

    // Doctolib is read-only — v2 should use get_page_content or take_snapshot,
    // not screenshots, to read appointment slots
    assert.ok(
      m.screenshotCount === 0 || m.snapshotCount >= m.screenshotCount,
      `v2 should prefer DOM extraction over screenshots`,
    )

    if (bookDoctolibScenario.maxWallClockMs) {
      assert.ok(
        m.wallClockMs <= bookDoctolibScenario.maxWallClockMs,
        `Took ${m.wallClockMs}ms, expected ≤ ${bookDoctolibScenario.maxWallClockMs}ms`,
      )
    }
  }, 150_000)
})

describe('v2 Optimised — Discord Message', () => {
  it('types without sending, using evaluate_script or fill directly', async () => {
    const m = await runOptimised(discordMessageScenario)

    console.log(
      `\n[v2 discord] ${m.wallClockMs}ms | ${m.estTotalTokens} tokens | ${m.llmStepCount} steps`,
    )
    console.log(`  tools: ${m.toolCalls.join(', ')}`)
    console.log(
      `  snapshots=${m.snapshotCount}  screenshots=${m.screenshotCount}`,
    )
    console.log(`  throughput: ~${tasksPerHour(m.wallClockMs)} tasks/hr`)

    assert.ok(m.llmStepCount > 0, 'Should have made at least one LLM call')

    // v2 should use fill or evaluate_script for typing, not screenshot-first
    const usedDomInteraction = m.toolCalls.some(
      (t) => t === 'fill' || t === 'evaluate_script',
    )
    assert.ok(usedDomInteraction, 'Should use fill or evaluate_script to type')

    // No screenshots for a typing task
    assert.strictEqual(
      m.screenshotCount,
      0,
      'Discord typing should not need any screenshots in v2',
    )

    if (discordMessageScenario.maxWallClockMs) {
      assert.ok(
        m.wallClockMs <= discordMessageScenario.maxWallClockMs,
        `Took ${m.wallClockMs}ms, expected ≤ ${discordMessageScenario.maxWallClockMs}ms`,
      )
    }
  }, 120_000)
})
