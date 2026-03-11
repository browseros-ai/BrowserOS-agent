/**
 * Sidepanel Performance Profiler
 *
 * Import in main.tsx:  import './perf-profiler'
 * Remove when done debugging.
 *
 * Instruments React rendering and key functions to identify bottlenecks.
 * After a conversation, run window.perfReport() for a full summary.
 */

interface FnProfile {
  calls: number
  totalMs: number
  maxMs: number
  maxArgs?: string
}

interface LongTask {
  duration: number
  startTime: number
}

interface RenderBatch {
  index: number
  mutations: number
  timestamp: number
}

const fnProfiles: Record<string, FnProfile> = {}
const longTasks: LongTask[] = []
const renderBatches: RenderBatch[] = []
let batchIndex = 0
let currentBatchMutations = 0
let lastMutationTime = 0
let startTime = 0
let initialDomNodes = 0
let peakDomNodes = 0
let domInterval: ReturnType<typeof setInterval> | null = null
let mutationObserver: MutationObserver | null = null
let longTaskObserver: PerformanceObserver | null = null

function trackFn(name: string, duration: number, argSummary?: string) {
  if (!fnProfiles[name]) {
    fnProfiles[name] = { calls: 0, totalMs: 0, maxMs: 0 }
  }
  const p = fnProfiles[name]
  p.calls++
  p.totalMs += duration
  if (duration > p.maxMs) {
    p.maxMs = duration
    if (argSummary) p.maxArgs = argSummary
  }
}

// ─── Monkey-patch React internals to track component render times ───

function patchReact() {
  const hook = (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook) return

  const renderers = (hook as { renderers?: Map<number, unknown> }).renderers
  if (!renderers) return

  for (const [, renderer] of renderers) {
    const r = renderer as Record<string, unknown>

    // Patch commitWork to track commit phase
    if (typeof r.commitWork === 'function') {
      const orig = r.commitWork as (...args: unknown[]) => unknown
      r.commitWork = function (...args: unknown[]) {
        const t0 = performance.now()
        const result = orig.apply(this, args)
        trackFn('React.commitWork', performance.now() - t0)
        return result
      }
    }

    // Patch beginWork to track render phase
    if (typeof r.beginWork === 'function') {
      const orig = r.beginWork as (...args: unknown[]) => unknown
      r.beginWork = function (...args: unknown[]) {
        const t0 = performance.now()
        const result = orig.apply(this, args)
        const dt = performance.now() - t0
        // Only track if >1ms to avoid noise
        if (dt > 1) {
          trackFn('React.beginWork (>1ms)', dt)
        }
        return result
      }
    }
  }
}

// ─── Patch module-level functions via import interception ───

function patchStreamdown() {
  // Intercept Streamdown rendering by observing data-streamdown elements
  const origCreateElement = document.createElement.bind(document)
  let streamdownRenders = 0

  const streamdownObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement && node.querySelector?.('[data-streamdown]')) {
          streamdownRenders++
          if (streamdownRenders % 50 === 0) {
            console.log(
              `%c📝 Streamdown has rendered ${streamdownRenders} times`,
              'color: #888',
            )
          }
        }
      }
    }
  })

  streamdownObserver.observe(document.body, { childList: true, subtree: true })
}

// ─── Patch performance-critical browser APIs ───

function patchBrowserAPIs() {
  // Track layout thrashing (forced synchronous layouts)
  const origGetBCR = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    trackFn('getBoundingClientRect', 0)
    return origGetBCR.call(this)
  }

  // Track expensive scroll operations
  const origScrollIntoView = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
    const t0 = performance.now()
    origScrollIntoView.call(this, arg as ScrollIntoViewOptions)
    trackFn('scrollIntoView', performance.now() - t0)
  }

  // Track JSON.parse (used in getMessageSegments for nudge parsing)
  const origJsonParse = JSON.parse
  JSON.parse = function (text: string, reviver?: Parameters<typeof origJsonParse>[1]) {
    const t0 = performance.now()
    const result = origJsonParse.call(this, text, reviver)
    const dt = performance.now() - t0
    if (dt > 1) {
      trackFn('JSON.parse (>1ms)', dt, `${text.length} chars`)
    }
    return result
  }

  // Track fetch calls (for SSE streaming, MCP integrations)
  const origFetch = window.fetch
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
    const t0 = performance.now()
    const result = await origFetch.apply(this, args)
    trackFn('fetch', performance.now() - t0, url)
    return result
  }

  // Track requestAnimationFrame frequency
  let rafCount = 0
  const origRAF = window.requestAnimationFrame
  window.requestAnimationFrame = function (cb: FrameRequestCallback) {
    rafCount++
    return origRAF.call(window, (timestamp) => {
      const t0 = performance.now()
      cb(timestamp)
      const dt = performance.now() - t0
      if (dt > 5) {
        trackFn('rAF callback (>5ms)', dt)
      }
    })
  }

  // Track setTimeout (detects polling, debounce patterns)
  const origSetTimeout = window.setTimeout
  const timeoutCounts: Record<string, number> = {}
  window.setTimeout = function (handler: TimerHandler, timeout?: number, ...args: unknown[]) {
    const key = `setTimeout(${timeout ?? 0}ms)`
    timeoutCounts[key] = (timeoutCounts[key] || 0) + 1
    return origSetTimeout.call(window, handler, timeout, ...args)
  } as typeof setTimeout

  // Expose for report
  ;(window as unknown as Record<string, unknown>).__timeoutCounts = timeoutCounts
  ;(window as unknown as Record<string, unknown>).__rafCount = () => rafCount
}

// ─── Start profiling ───

function start() {
  startTime = performance.now()
  initialDomNodes = document.querySelectorAll('*').length
  peakDomNodes = initialDomNodes

  // Long task observer
  longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const task = {
        duration: Math.round(entry.duration),
        startTime: Math.round(entry.startTime),
      }
      longTasks.push(task)
      if (task.duration > 200) {
        console.warn(
          `%c⚠ Long task: ${task.duration}ms at ${((entry.startTime - startTime) / 1000).toFixed(1)}s`,
          'color: #ff6b35; font-weight: bold',
        )
      }
    }
  })
  longTaskObserver.observe({ type: 'longtask', buffered: false })

  // DOM mutation observer
  mutationObserver = new MutationObserver((mutations) => {
    const now = performance.now()
    if (now - lastMutationTime > 16 && currentBatchMutations > 0) {
      renderBatches.push({
        index: batchIndex++,
        mutations: currentBatchMutations,
        timestamp: Math.round(now - startTime),
      })
      currentBatchMutations = 0
    }
    currentBatchMutations += mutations.length
    lastMutationTime = now
  })
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  })

  // Periodic DOM snapshot
  domInterval = setInterval(() => {
    const nodes = document.querySelectorAll('*').length
    if (nodes > peakDomNodes) peakDomNodes = nodes
  }, 3000)

  // Patch everything
  patchReact()
  patchStreamdown()
  patchBrowserAPIs()

  console.log(
    '%c🔬 Performance profiler started.\n' +
      '   Send messages to profile.\n' +
      '   window.perfReport()  → full report\n' +
      '   window.perfStop()    → report + stop\n' +
      '   window.perfRestart() → reset + restart',
    'color: #4CAF50; font-weight: bold; font-size: 12px',
  )
}

// ─── Report ───

function report() {
  // Flush remaining batch
  if (currentBatchMutations > 0) {
    renderBatches.push({
      index: batchIndex++,
      mutations: currentBatchMutations,
      timestamp: Math.round(performance.now() - startTime),
    })
    currentBatchMutations = 0
  }

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(1)
  const finalDomNodes = document.querySelectorAll('*').length
  const totalMutations = renderBatches.reduce((s, b) => s + b.mutations, 0)
  const longTaskTotal = longTasks.reduce((s, t) => s + t.duration, 0)
  const worstTask = longTasks.length ? Math.max(...longTasks.map((t) => t.duration)) : 0

  console.log('\n')
  console.log('%c╔══════════════════════════════════════╗', 'color: #ff6b35; font-weight: bold')
  console.log('%c║     PERFORMANCE REPORT               ║', 'color: #ff6b35; font-weight: bold; font-size: 14px')
  console.log('%c╚══════════════════════════════════════╝', 'color: #ff6b35; font-weight: bold')

  // ── Function hotspots (the main thing you want) ──
  console.log(
    '%c\n🔥 FUNCTION HOTSPOTS (sorted by total time)',
    'color: #f44336; font-weight: bold; font-size: 13px',
  )
  const sortedFns = Object.entries(fnProfiles)
    .map(([name, p]) => ({
      name,
      calls: p.calls,
      'total ms': Math.round(p.totalMs),
      'max ms': Math.round(p.maxMs),
      'avg ms': p.calls ? +(p.totalMs / p.calls).toFixed(2) : 0,
      'slowest args': p.maxArgs || '',
    }))
    .filter((f) => f['total ms'] > 0 || f.calls > 100)
    .sort((a, b) => b['total ms'] - a['total ms'])

  if (sortedFns.length > 0) {
    console.table(sortedFns)
  } else {
    console.log('No significant function time recorded.')
  }

  // ── Summary ──
  console.log(
    '%c\n📋 Summary',
    'color: #2196F3; font-weight: bold; font-size: 13px',
  )
  console.table({
    'Duration': { value: `${totalTime}s` },
    'DOM nodes (start → end)': { value: `${initialDomNodes} → ${finalDomNodes} (+${finalDomNodes - initialDomNodes})` },
    'DOM nodes (peak)': { value: peakDomNodes },
    'Render batches': { value: renderBatches.length },
    'Total DOM mutations': { value: totalMutations },
    'Long tasks (>50ms)': { value: longTasks.length },
    'Total blocked time': { value: `${longTaskTotal}ms` },
    'Worst long task': { value: `${worstTask}ms` },
    'rAF calls': { value: ((window as unknown as Record<string, unknown>).__rafCount as () => number)?.() ?? 'N/A' },
  })

  // ── Long tasks timeline ──
  if (longTasks.length > 0) {
    console.log(
      '%c\n🔴 Top 10 Long Tasks',
      'color: #f44336; font-weight: bold; font-size: 13px',
    )
    console.table(
      longTasks
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map((t, i) => ({
          rank: i + 1,
          duration: `${t.duration}ms`,
          at: `${((t.startTime) / 1000).toFixed(1)}s`,
        })),
    )
  }

  // ── Heavy render batches ──
  const heavyBatches = renderBatches.filter((b) => b.mutations > 50)
  if (heavyBatches.length > 0) {
    console.log(
      '%c\n🔄 Heavy Render Batches (>50 mutations)',
      'color: #9C27B0; font-weight: bold; font-size: 13px',
    )
    console.table(
      heavyBatches
        .sort((a, b) => b.mutations - a.mutations)
        .slice(0, 10)
        .map((b, i) => ({
          rank: i + 1,
          mutations: b.mutations,
          at: `${(b.timestamp / 1000).toFixed(1)}s`,
        })),
    )
  }

  // ── setTimeout patterns ──
  const timeoutCounts = (window as unknown as Record<string, unknown>).__timeoutCounts as Record<string, number> | undefined
  if (timeoutCounts) {
    const sorted = Object.entries(timeoutCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    if (sorted.length > 0) {
      console.log(
        '%c\n⏱ Top setTimeout Patterns (polling/debounce detection)',
        'color: #795548; font-weight: bold; font-size: 13px',
      )
      console.table(sorted.map(([key, count]) => ({ pattern: key, count })))
    }
  }

  // ── Diagnosis ──
  console.log(
    '%c\n🩺 Diagnosis',
    'color: #FF9800; font-weight: bold; font-size: 13px',
  )

  if (sortedFns.length > 0) {
    const top = sortedFns[0]
    console.log(`🏆 Biggest bottleneck: ${top.name} — ${top['total ms']}ms total across ${top.calls} calls (max single: ${top['max ms']}ms)`)
    if (sortedFns.length > 1) {
      const second = sortedFns[1]
      console.log(`🥈 Second: ${second.name} — ${second['total ms']}ms total across ${second.calls} calls`)
    }
  }

  if (worstTask > 500) {
    console.log(`❌ Worst long task: ${worstTask}ms — causes visible UI freeze`)
  }
  if (finalDomNodes > 5000) {
    console.log(`❌ ${finalDomNodes} DOM nodes — consider virtualization`)
  }
  if (totalMutations > 5000) {
    console.log(`❌ ${totalMutations} DOM mutations — too many re-renders`)
  }

  console.log('%c\n══════════════════════════════════════\n', 'color: #ff6b35; font-weight: bold')
}

function stop() {
  mutationObserver?.disconnect()
  longTaskObserver?.disconnect()
  if (domInterval) clearInterval(domInterval)
  console.log('%c🛑 Profiler stopped.', 'color: #f44336; font-weight: bold')
}

// ─── Window API ───

declare global {
  interface Window {
    perfReport: () => void
    perfStop: () => void
    perfRestart: () => void
  }
}

window.perfReport = report
window.perfStop = () => { report(); stop() }
window.perfRestart = () => {
  stop()
  Object.keys(fnProfiles).forEach((k) => delete fnProfiles[k])
  longTasks.length = 0
  renderBatches.length = 0
  batchIndex = 0
  currentBatchMutations = 0
  start()
}

start()
