import { LLMProvider, TestResult } from '../types/llm-settings'
import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'

export interface PerformanceScore {
  instructionFollowing: number
  contextUnderstanding: number
  toolUsage: number
  planning: number
  errorRecovery: number
  performance: number
  overall: number
}


export interface BenchmarkResult {
  success: boolean
  latency: number
  scores: PerformanceScore
  taskResults?: any[]
  error?: string
  timestamp: string
}

// Export convenience functions
export async function testLLMProvider(provider: LLMProvider): Promise<TestResult> {
  const service = LLMTestService.getInstance()
  return service.testProvider(provider)
}

export async function benchmarkLLMProvider(provider: LLMProvider): Promise<TestResult> {
  const service = LLMTestService.getInstance()
  const result = await service.benchmarkProvider(provider)

  // Convert BenchmarkResult to TestResult format
  if (result.success) {
    // Convert PerformanceScore to Record<string, number>
    const scoresRecord: Record<string, number> = {
      instructionFollowing: result.scores.instructionFollowing,
      contextUnderstanding: result.scores.contextUnderstanding,
      toolUsage: result.scores.toolUsage,
      planning: result.scores.planning,
      errorRecovery: result.scores.errorRecovery,
      performance: result.scores.performance,
      overall: result.scores.overall
    }

    return {
      status: 'success',
      responseTime: result.latency,
      timestamp: result.timestamp,
      benchmark: {
        overallScore: result.scores.overall,
        scores: scoresRecord,
        summary: generateBenchmarkSummary(result)
      }
    }
  } else {
    return {
      status: 'error',
      error: result.error || 'Benchmark failed',
      timestamp: result.timestamp
    }
  }
}

function generateBenchmarkSummary(result: BenchmarkResult): string {
  const { scores } = result
  const overall = scores.overall

  let summary = `Overall Score: ${overall.toFixed(1)}/10\n\n`

  // Performance level
  if (overall >= 8) {
    summary += '🏆 Excellent Performance - Highly recommended for complex agent tasks\n'
  } else if (overall >= 6) {
    summary += '✅ Good Performance - Suitable for most automation tasks\n'
  } else if (overall >= 4) {
    summary += '⚠️ Moderate Performance - Best for simple tasks\n'
  } else {
    summary += '❌ Poor Performance - Not recommended for automation\n'
  }

  // Category breakdown
  summary += '\nCategory Scores:\n'
  summary += `• Instruction Following: ${scores.instructionFollowing}/10\n`
  summary += `• Context Understanding: ${scores.contextUnderstanding}/10\n`
  summary += `• Tool Usage: ${scores.toolUsage}/10\n`
  summary += `• Planning: ${scores.planning}/10\n`
  summary += `• Error Recovery: ${scores.errorRecovery}/10\n`
  summary += `• Performance: ${scores.performance}/10`

  return summary
}

export class LLMTestService {
  private static instance: LLMTestService

  static getInstance(): LLMTestService {
    if (!LLMTestService.instance) {
      LLMTestService.instance = new LLMTestService()
    }
    return LLMTestService.instance
  }

  async testProvider(provider: LLMProvider): Promise<TestResult> {
    return new Promise((resolve) => {
      const port = chrome.runtime.connect({ name: 'options' })
      const messageId = `test-${Date.now()}`
      let timeoutTimer: NodeJS.Timeout | null = null

      const cleanup = () => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer)
          timeoutTimer = null
        }
        try {
          port.onMessage.removeListener(listener)
          port.disconnect()
        } catch (e) {
          // Port might already be disconnected
        }
      }

      const listener = (msg: PortMessage) => {
        if (msg.id === messageId && msg.type === MessageType.SETTINGS_TEST_PROVIDER_RESPONSE) {
          cleanup()
          const payload = msg.payload as any

          // Convert the response to TestResult format
          resolve({
            status: payload.success ? 'success' : 'error',
            responseTime: payload.latency,
            error: payload.error,
            timestamp: payload.timestamp
          })
        } else if (msg.id === messageId && msg.type === MessageType.ERROR) {
          cleanup()
          const payload = msg.payload as any
          resolve({
            status: 'error',
            error: payload.error || 'Unknown error',
            timestamp: new Date().toISOString()
          })
        }
      }

      port.onMessage.addListener(listener)

      port.postMessage({
        type: MessageType.SETTINGS_TEST_PROVIDER,
        payload: { provider },
        id: messageId
      })

      timeoutTimer = setTimeout(() => {
        cleanup()
        resolve({
          status: 'error',
          error: 'Test timeout after 30 seconds',
          timestamp: new Date().toISOString()
        })
      }, 30000)
    })
  }

  async benchmarkProvider(provider: LLMProvider, progressCallback?: (progress: string) => void): Promise<BenchmarkResult> {
    return new Promise((resolve) => {
      let port: chrome.runtime.Port | null = null
      let keepAliveInterval: NodeJS.Timeout | null = null
      let timeoutTimer: NodeJS.Timeout | null = null
      const messageId = `benchmark-${Date.now()}`

      // Function to cleanup resources
      const cleanup = () => {
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval)
          keepAliveInterval = null
        }
        if (timeoutTimer) {
          clearTimeout(timeoutTimer)
          timeoutTimer = null
        }
        if (port) {
          try {
            port.onMessage.removeListener(listener)
            port.onDisconnect.removeListener(disconnectListener)
            port.disconnect()
          } catch (e) {
            // Port might already be disconnected
          }
          port = null
        }
      }

      const listener = (msg: PortMessage) => {
        // Handle progress messages
        if (msg.id === `${messageId}_progress` && msg.type === MessageType.SETTINGS_BENCHMARK_PROGRESS) {
          const payload = msg.payload as any
          if (progressCallback && payload?.message) {
            progressCallback(payload.message)
          }
          return  // Don't cleanup for progress messages
        }

        if (msg.id === messageId && msg.type === MessageType.SETTINGS_BENCHMARK_PROVIDER_RESPONSE) {
          cleanup()
          const payload = msg.payload as any
          resolve(payload as BenchmarkResult)
        } else if (msg.id === messageId && msg.type === MessageType.ERROR) {
          cleanup()
          const payload = msg.payload as any
          resolve({
            success: false,
            latency: 0,
            scores: {
              instructionFollowing: 0,
              contextUnderstanding: 0,
              toolUsage: 0,
              planning: 0,
              errorRecovery: 0,
              performance: 0,
              overall: 0
            },
            error: payload.error || 'Unknown error',
            timestamp: new Date().toISOString()
          })
        }
      }

      const disconnectListener = () => {
        // Port was disconnected unexpectedly
        cleanup()
        resolve({
          success: false,
          latency: 0,
          scores: {
            instructionFollowing: 0,
            contextUnderstanding: 0,
            toolUsage: 0,
            planning: 0,
            errorRecovery: 0,
            performance: 0,
            overall: 0
          },
          error: 'Connection lost to background service. Please try again.',
          timestamp: new Date().toISOString()
        })
      }

      try {
        port = chrome.runtime.connect({ name: 'options' })

        port.onMessage.addListener(listener)
        port.onDisconnect.addListener(disconnectListener)

        // Send keep-alive ping every 20 seconds to prevent disconnection
        keepAliveInterval = setInterval(() => {
          if (port) {
            try {
              port.postMessage({
                type: 'KEEP_ALIVE',
                id: `keepalive-${messageId}`
              })
            } catch (e) {
              // Port might be disconnected
              cleanup()
            }
          }
        }, 20000) // Every 20 seconds

        port.postMessage({
          type: MessageType.SETTINGS_BENCHMARK_PROVIDER,
          payload: { provider },
          id: messageId
        })

        // Set timeout for 180 seconds (3 minutes) instead of 120
        timeoutTimer = setTimeout(() => {
          cleanup()
          resolve({
            success: false,
            latency: 180000,
            scores: {
              instructionFollowing: 0,
              contextUnderstanding: 0,
              toolUsage: 0,
              planning: 0,
              errorRecovery: 0,
              performance: 0,
              overall: 0
            },
            error: 'Benchmark timeout after 3 minutes. The provider may be unresponsive.',
            timestamp: new Date().toISOString()
          })
        }, 180000)  // 180 seconds (3 minutes) for comprehensive benchmark

      } catch (error) {
        cleanup()
        resolve({
          success: false,
          latency: 0,
          scores: {
            instructionFollowing: 0,
            contextUnderstanding: 0,
            toolUsage: 0,
            planning: 0,
            errorRecovery: 0,
            performance: 0,
            overall: 0
          },
          error: error instanceof Error ? error.message : 'Failed to connect to extension service',
          timestamp: new Date().toISOString()
        })
      }
    })
  }


  /**
   * Store test results in localStorage (not BrowserOS prefs as these are temporary)
   */
  async storeTestResults(providerId: string, results: TestResult, scores?: PerformanceScore): Promise<boolean> {
    const data = {
      providerId,
      testResult: results,
      performanceScores: scores,
      timestamp: new Date().toISOString()
    }

    try {
      // Use localStorage for temporary test results
      localStorage.setItem(`llm_test_results_${providerId}`, JSON.stringify(data))
      return true
    } catch (error) {
      console.error('Failed to store test results:', error)
      return false
    }
  }

  async getStoredResults(providerId: string): Promise<{ testResult: TestResult; performanceScores?: PerformanceScore } | null> {
    try {
      // Get from localStorage
      const stored = localStorage.getItem(`llm_test_results_${providerId}`)
      if (stored) {
        const data = JSON.parse(stored)
        return data
      }
      return null
    } catch (error) {
      console.error('Failed to get stored results:', error)
      return null
    }
  }
}