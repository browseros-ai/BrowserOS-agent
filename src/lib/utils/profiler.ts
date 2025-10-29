/**
 * Simple performance profiler using performance.mark/measure
 * Only active when DEV_MODE is enabled
 */

import { config } from '@/config';

// Control whether to write profile information to console
const ENABLE_CONSOLE_LOGGING = false;

// Track start times for calculating durations
const startTimes = new Map<string, number>();

// Call stack for tracking nested profiling
const callStack: string[] = [];

// Chrome Trace Event Format types
interface TraceEvent {
  name: string;  // Event name
  cat: string;  // Category (comma-separated list)
  ph: 'B' | 'E' | 'X' | 'i' | 's' | 'f' | 'M';  // Phase: Begin/End/Complete/Instant/Async Start/Finish/Metadata
  ts: number;  // Timestamp in microseconds
  pid: number;  // Process ID
  tid: number;  // Thread ID
  args?: Record<string, any>;  // Additional arguments
  dur?: number;  // Duration for 'X' events
}

// Trace events collection
const traceEvents: TraceEvent[] = [];

// Store the initial timestamp for relative time calculation
let startTimestamp: number | null = null;

// Convert performance.now() to microseconds
function toMicroseconds(ms: number): number {
  // Use relative timestamps starting from 0
  if (startTimestamp === null) {
    startTimestamp = ms;
  }
  // Return relative microseconds from start
  return Math.round((ms - startTimestamp) * 1000);
}

/**
 * Start a profile if DEV_MODE is enabled
 * @param label - Profile label to identify in DevTools
 */
export function profileStart(label: string): void {
  if (!config.DEV_MODE) return;
  
  try {
    const startTime = performance.now();
    startTimes.set(label, startTime);
    
    // Add to call stack
    callStack.push(label);
    
    // Create a performance mark
    performance.mark(`${label}-start`);
    
    // Add Begin trace event
    traceEvents.push({
      name: label,
      cat: 'profile',
      ph: 'B',
      ts: toMicroseconds(startTime),
      pid: 1,
      tid: 1
    });
    
    // Log start in console with indentation based on call stack depth
    if (ENABLE_CONSOLE_LOGGING) {
      const indent = '  '.repeat(callStack.length - 1);
      console.log(`${indent}⏱️ [START] ${label}`);
    }
  } catch (e) {
    // Silently fail if performance API not available
  }
}

/**
 * End a profile if DEV_MODE is enabled
 * @param label - Profile label to end
 */
export function profileEnd(label: string): void {
  if (!config.DEV_MODE) return;
  
  try {
    const startTime = startTimes.get(label);
    if (startTime !== undefined) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      startTimes.delete(label);
      
      // Remove from call stack
      const stackIndex = callStack.lastIndexOf(label);
      if (stackIndex !== -1) {
        callStack.splice(stackIndex, 1);
      }
      
      // Create end mark and measure
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      
      // Add End trace event
      traceEvents.push({
        name: label,
        cat: 'profile',
        ph: 'E',
        ts: toMicroseconds(endTime),
        pid: 1,
        tid: 1
      });
      
      // Log with color coding based on duration and indentation
      if (ENABLE_CONSOLE_LOGGING) {
        const indent = '  '.repeat(callStack.length);
        const color = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢';
        console.log(`${indent}${color} [END] ${label}: ${duration.toFixed(2)}ms`);
      }
      
      // Clean up marks
      performance.clearMarks(`${label}-start`);
      performance.clearMarks(`${label}-end`);
    }
  } catch (e) {
    // Silently fail if performance API not available
  }
}

/**
 * Profile an async function
 * @param label - Profile label
 * @param fn - Async function to profile
 * @returns Result of the function
 */
export async function profileAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  profileStart(label);
  try {
    return await fn();
  } finally {
    profileEnd(label);
  }
}

/**
 * Profile a sync function
 * @param label - Profile label
 * @param fn - Function to profile
 * @returns Result of the function
 */
export function profileSync<T>(
  label: string,
  fn: () => T
): T {
  profileStart(label);
  try {
    return fn();
  } finally {
    profileEnd(label);
  }
}

/**
 * Method decorator for profiling
 * @param customLabel - Optional custom label (defaults to ClassName.methodName)
 */
export function profile(customLabel?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const label = customLabel || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);
      
      // Handle async methods
      if (result && typeof result.then === 'function') {
        return profileAsync(label, () => result);
      }
      
      // Handle sync methods
      return profileSync(label, () => result);
    };

    return descriptor;
  };
}

/**
 * Get all performance measures (for debugging)
 * @returns Array of performance entries
 */
export function getProfileMeasures(): PerformanceEntry[] {
  if (!config.DEV_MODE) return [];
  
  try {
    return performance.getEntriesByType('measure');
  } catch (e) {
    return [];
  }
}

/**
 * Display performance report in console
 */
export function showProfileReport(): void {
  if (!config.DEV_MODE || !ENABLE_CONSOLE_LOGGING) return;
  
  const measures = getProfileMeasures();
  if (measures.length === 0) {
    console.log('No performance measures recorded');
    return;
  }
  
  console.log('\n📊 Performance Report (All Measures):');
  console.log('='.repeat(70));
  
  // Group measures by name to show counts
  const operationCounts: Record<string, number> = {};
  measures.forEach(measure => {
    operationCounts[measure.name] = (operationCounts[measure.name] || 0) + 1;
  });
  
  const sortedMeasures = [...measures].sort((a, b) => b.duration - a.duration);
  
  sortedMeasures.forEach(measure => {
    const duration = measure.duration;
    const color = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢';
    const count = operationCounts[measure.name];
    const countInfo = count > 1 ? ` (1 of ${count})` : '';
    console.log(`${color} ${measure.name.padEnd(40)} ${duration.toFixed(2).padStart(10)}ms${countInfo}`);
  });
  
  console.log('='.repeat(70));
  console.log(`Total measures: ${measures.length}`);
  console.log(`Unique operations: ${Object.keys(operationCounts).length}`);
}

/**
 * Get performance summary with total time and top operations
 * @returns Object containing total time and top operations
 */
export function getPerformanceSummary(): {
  totalTime: number;
  totalCount: number;
  avgTime: number;
  topOperations: Array<{ name: string; duration: number; count: number; avgDuration: number }>;
  frequentOperations: Array<{ name: string; count: number; totalDuration: number; avgDuration: number }>;
} {
  if (!config.DEV_MODE) return { totalTime: 0, totalCount: 0, avgTime: 0, topOperations: [], frequentOperations: [] };
  
  const measures = getProfileMeasures();
  if (measures.length === 0) {
    return { totalTime: 0, totalCount: 0, avgTime: 0, topOperations: [], frequentOperations: [] };
  }
  
  let totalTime = 0;
  const operationStats: Record<string, { count: number; totalDuration: number; maxDuration: number }> = {};
  
  // Process each measure and group by operation name
  measures.forEach(measure => {
    totalTime += measure.duration;
    
    if (!operationStats[measure.name]) {
      operationStats[measure.name] = { count: 0, totalDuration: 0, maxDuration: 0 };
    }
    
    operationStats[measure.name].count++;
    operationStats[measure.name].totalDuration += measure.duration;
    operationStats[measure.name].maxDuration = Math.max(operationStats[measure.name].maxDuration, measure.duration);
  });
  
  // Calculate average
  const avgTime = totalTime / measures.length;
  
  // Convert to array and calculate averages
  const operationsArray = Object.entries(operationStats).map(([name, stats]) => ({
    name,
    count: stats.count,
    totalDuration: stats.totalDuration,
    avgDuration: stats.totalDuration / stats.count,
    maxDuration: stats.maxDuration
  }));
  
  // Get top 5 operations by max duration
  const topOperations = [...operationsArray]
    .sort((a, b) => b.maxDuration - a.maxDuration)
    .slice(0, 5)
    .map(op => ({
      name: op.name,
      duration: op.maxDuration,
      count: op.count,
      avgDuration: op.avgDuration
    }));
  
  // Get top 5 most frequent operations
  const frequentOperations = [...operationsArray]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(op => ({
      name: op.name,
      count: op.count,
      totalDuration: op.totalDuration,
      avgDuration: op.avgDuration
    }));
  
  return { totalTime, totalCount: measures.length, avgTime, topOperations, frequentOperations };
}

/**
 * Display a compact performance summary
 */
export function showPerformanceSummary(): void {
  if (!config.DEV_MODE || !ENABLE_CONSOLE_LOGGING) return;
  
  const summary = getPerformanceSummary();
  
  if (summary.totalTime === 0) {
    console.log('No performance data to summarize');
    return;
  }
  
  console.log('\n📈 Performance Summary:');
  console.log('='.repeat(50));
  console.log(`⏱️  Total Time: ${summary.totalTime.toFixed(2)}ms`);
  console.log(`📊 Total Operations: ${summary.totalCount}`);
  console.log(`📉 Average Time: ${summary.avgTime.toFixed(2)}ms`);
  
  console.log('\n🔥 Slowest Operations (by max duration):');
  summary.topOperations.forEach((op, index) => {
    const color = op.duration > 1000 ? '🔴' : op.duration > 500 ? '🟡' : '🟢';
    console.log(`${color} ${(index + 1).toString().padEnd(2)}. ${op.name.padEnd(40)} Max: ${op.duration.toFixed(2).padStart(10)}ms | Count: ${op.count.toString().padStart(3)} | Avg: ${op.avgDuration.toFixed(2).padStart(10)}ms`);
  });
  
  console.log('\n🔄 Most Frequent Operations:');
  summary.frequentOperations.forEach((op, index) => {
    const color = op.avgDuration > 1000 ? '🔴' : op.avgDuration > 500 ? '🟡' : '🟢';
    console.log(`${color} ${(index + 1).toString().padEnd(2)}. ${op.name.padEnd(40)} Count: ${op.count.toString().padStart(3)} | Total: ${op.totalDuration.toFixed(2).padStart(10)}ms | Avg: ${op.avgDuration.toFixed(2).padStart(10)}ms`);
  });
  
  console.log('='.repeat(50));
}

/**
 * Export trace events in Chrome Trace Event Format
 * @returns JSON string that can be loaded in chrome://tracing or Perfetto
 */
export function exportTraceEvents(): string {
  if (!config.DEV_MODE) return '{"traceEvents":[]}';
  
  // Add metadata events for Chrome trace format
  const metadataEvents: TraceEvent[] = [
    {
      name: 'process_name',
      ph: 'M',
      ts: 0,
      pid: 1,
      tid: 1,
      cat: '__metadata',
      args: {
        name: 'Browser Extension'
      }
    },
    {
      name: 'thread_name',
      ph: 'M',
      ts: 0,
      pid: 1,
      tid: 1,
      cat: '__metadata',
      args: {
        name: 'Main Thread'
      }
    }
  ];
  
  // Combine metadata and trace events
  const allEvents = [...metadataEvents, ...traceEvents];
  
  // Chrome JSON trace format expects either:
  // 1. An array of events (JSON Array Format)
  // 2. An object with "traceEvents" array (JSON Object Format)
  // Using JSON Object Format for better compatibility
  const trace = {
    traceEvents: allEvents
  };
  
  // Optional: Add displayTimeUnit if you want to override default
  // trace.displayTimeUnit = "ms";
  
  return JSON.stringify(trace);
}

/**
 * Export trace events in legacy Chrome trace array format
 * @returns JSON string with just an array of events
 */
export function exportTraceEventsLegacy(): string {
  if (!config.DEV_MODE) return '[]';
  
  // Add metadata events for Chrome trace format
  const metadataEvents: TraceEvent[] = [
    {
      name: 'process_name',
      ph: 'M',
      ts: 0,
      pid: 1,
      tid: 1,
      cat: '__metadata',
      args: {
        name: 'Browser Extension'
      }
    },
    {
      name: 'thread_name',
      ph: 'M',
      ts: 0,
      pid: 1,
      tid: 1,
      cat: '__metadata',
      args: {
        name: 'Main Thread'
      }
    }
  ];
  
  // Combine metadata and trace events
  const allEvents = [...metadataEvents, ...traceEvents];
  
  // Return just the array (JSON Array Format)
  return JSON.stringify(allEvents);
}


/**
 * Clear all trace events
 */
export function clearTraceEvents(): void {
  traceEvents.length = 0;
  callStack.length = 0;
  startTimestamp = null;
  startTimes.clear();
  if (ENABLE_CONSOLE_LOGGING) {
    console.log('🧹 Trace events cleared');
  }
}

/**
 * Get current trace event count
 */
export function getTraceEventCount(): number {
  return traceEvents.length;
}

/**
 * Generate a test trace to verify format
 */
export function generateTestTrace(): void {
  if (!config.DEV_MODE) return;
  
  // Clear existing traces
  clearTraceEvents();
  
  if (ENABLE_CONSOLE_LOGGING) {
    console.log('🧪 Generating test trace...');
  }
  
  // Simulate nested method calls
  profileStart('main');
    profileStart('processData');
      profileStart('fetchData');
      profileEnd('fetchData');
      profileStart('parseData');
      profileEnd('parseData');
    profileEnd('processData');
    profileStart('renderResults');
    profileEnd('renderResults');
  profileEnd('main');
  
  if (ENABLE_CONSOLE_LOGGING) {
    console.log(`✅ Test trace generated with ${getTraceEventCount()} events`);
    console.log('💡 Use profiler.exportTrace() to get the trace data');
  }
}


// Make functions available globally for debugging
if (config.DEV_MODE) {
  // Use globalThis for better compatibility across environments (window, service workers, etc.)
  (globalThis as any).__profileReport = showProfileReport;
  (globalThis as any).__profileMeasures = getProfileMeasures;
  (globalThis as any).__profileStart = profileStart;
  (globalThis as any).__profileEnd = profileEnd;
  (globalThis as any).__profileSummary = showPerformanceSummary;
  (globalThis as any).__profileGetSummary = getPerformanceSummary;
  (globalThis as any).__profileExportTrace = exportTraceEvents;
  (globalThis as any).__profileExportTraceLegacy = exportTraceEventsLegacy;
  (globalThis as any).__profileClearTrace = clearTraceEvents;
  (globalThis as any).__profileTraceCount = getTraceEventCount;
  (globalThis as any).__profileTestTrace = generateTestTrace;
  
  // Also expose under a namespace for cleaner access
  (globalThis as any).profiler = {
    start: profileStart,
    end: profileEnd,
    report: showProfileReport,
    measures: getProfileMeasures,
    summary: showPerformanceSummary,
    getSummary: getPerformanceSummary,
    exportTrace: exportTraceEvents,
    exportTraceLegacy: exportTraceEventsLegacy,
    clearTrace: clearTraceEvents,
    traceCount: getTraceEventCount,
    testTrace: generateTestTrace,
  };
  
  if (ENABLE_CONSOLE_LOGGING) {
    console.log('🚀 Profiler with trace export loaded. Key commands:');
    console.log('  profiler.start(label) - Start profiling');
    console.log('  profiler.end(label) - End profiling');
    console.log('  profiler.exportTrace() - Export trace for Perfetto/chrome://tracing');
    console.log('  profiler.exportTraceLegacy() - Export trace in array format');
    console.log('  profiler.clearTrace() - Clear all trace events');
    console.log('  profiler.testTrace() - Generate test trace');
    console.log('  profiler.report() - Show performance report');
    console.log('  profiler.summary() - Show performance summary');
    console.log('  ');
    console.log('  💡 Usage: copy(profiler.exportTrace()) then save as .json');
  }
}
