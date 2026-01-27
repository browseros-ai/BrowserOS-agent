/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * useSwarm - React hook for managing swarm state and API communication
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  SwarmEvent,
  SwarmState,
  SwarmStatus,
  SwarmWorker,
  WorkerStatus,
} from '@/components/swarm/types'
import { getAgentServerUrl } from '@/lib/browseros/helpers'

interface SwarmConfig {
  maxWorkers?: number
  timeout?: number
}

interface UseSwarmReturn {
  // State
  swarm: SwarmState | null
  isLoading: boolean
  error: string | null

  // Actions
  startSwarm: (
    task: string,
    options?: { maxWorkers?: number; priority?: string },
  ) => Promise<void>
  stopSwarm: () => Promise<void>
  arrangeWindows: (layout: 'grid' | 'cascade' | 'tile') => Promise<void>
  focusWorker: (workerId: string) => Promise<void>
  terminateWorker: (workerId: string) => Promise<void>
  reset: () => void
}

const defaultConfig: SwarmConfig = {
  maxWorkers: 5,
  timeout: 600000, // 10 minutes
}

/**
 * React hook for managing AI Swarm Mode
 *
 * @example
 * ```tsx
 * const { swarm, startSwarm, stopSwarm } = useSwarm()
 *
 * const handleSubmit = async (task: string) => {
 *   await startSwarm(task, { maxWorkers: 5 })
 * }
 * ```
 */
export function useSwarm(config: Partial<SwarmConfig> = {}): UseSwarmReturn {
  const { maxWorkers } = { ...defaultConfig, ...config }

  const [swarm, setSwarm] = useState<SwarmState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      abortControllerRef.current?.abort()
    }
  }, [])

  const handleSwarmEvent = useCallback((event: SwarmEvent) => {
    setSwarm((prev) => {
      if (!prev) return prev

      switch (event.type) {
        case 'status': {
          const status = event.data as SwarmStatus
          return { ...prev, status }
        }

        case 'worker_update': {
          const workerUpdate = event.data as Partial<SwarmWorker> & {
            id: string
          }
          const workers = prev.workers.map((w) =>
            w.id === workerUpdate.id ? { ...w, ...workerUpdate } : w,
          )
          return { ...prev, workers }
        }

        case 'progress': {
          const { progress, workerProgress } = event.data as {
            progress: number
            workerProgress?: Record<string, number>
          }
          let workers = prev.workers
          if (workerProgress) {
            workers = prev.workers.map((w) => ({
              ...w,
              progress: workerProgress[w.id] ?? w.progress,
            }))
          }
          return { ...prev, progress, workers }
        }

        case 'result': {
          const { result, workerId } = event.data as {
            result: string
            workerId?: string
          }
          if (workerId) {
            const workers = prev.workers.map((w) =>
              w.id === workerId
                ? { ...w, result, status: 'completed' as WorkerStatus }
                : w,
            )
            return { ...prev, workers }
          }
          return { ...prev, result }
        }

        case 'error': {
          const { error: errorMsg, workerId } = event.data as {
            error: string
            workerId?: string
          }
          if (workerId) {
            const workers = prev.workers.map((w) =>
              w.id === workerId
                ? { ...w, error: errorMsg, status: 'failed' as WorkerStatus }
                : w,
            )
            return { ...prev, workers }
          }
          return { ...prev, error: errorMsg, status: 'failed' }
        }

        case 'complete': {
          const { result, metrics } = event.data as {
            result?: string
            metrics?: SwarmState['metrics']
          }
          return {
            ...prev,
            status: 'completed',
            result,
            metrics,
            completedAt: Date.now(),
            progress: 100,
          }
        }

        default:
          return prev
      }
    })
  }, [])

  const startSwarm = useCallback(
    async (
      task: string,
      options?: { maxWorkers?: number; priority?: string },
    ) => {
      setIsLoading(true)
      setError(null)

      // Close any existing connection
      eventSourceRef.current?.close()
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      try {
        // Get server URL
        const serverUrl = await getAgentServerUrl()

        // Initialize swarm state
        const swarmId = crypto.randomUUID()
        const workerCount = options?.maxWorkers ?? maxWorkers ?? 5

        const initialWorkers: SwarmWorker[] = Array.from(
          { length: workerCount },
          (_, i) => ({
            id: `worker-${i + 1}`,
            status: 'pending',
            progress: 0,
          }),
        )

        setSwarm({
          id: swarmId,
          status: 'planning',
          task,
          workers: initialWorkers,
          progress: 0,
          startedAt: Date.now(),
        })

        // Start streaming via SSE
        const params = new URLSearchParams({
          task,
          maxWorkers: String(workerCount),
          ...(options?.priority && { priority: options.priority }),
        })

        const eventSource = new EventSource(
          `${serverUrl}/swarm/stream?${params}`,
        )
        eventSourceRef.current = eventSource

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as SwarmEvent
            handleSwarmEvent(data)
          } catch {
            // Ignore parse errors
          }
        }

        eventSource.onerror = () => {
          setError('Connection to swarm lost')
          setIsLoading(false)
          eventSource.close()
        }

        eventSource.addEventListener('complete', (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data) as SwarmEvent
            handleSwarmEvent(data)
          } catch {
            // Ignore
          }
          setIsLoading(false)
          eventSource.close()
        })

        // SSE stream handles the swarm execution - no separate POST needed
      } catch (e) {
        const errorMsg =
          e instanceof Error ? e.message : 'Failed to start swarm'
        setError(errorMsg)
        setSwarm((prev) =>
          prev ? { ...prev, status: 'failed', error: errorMsg } : null,
        )
        setIsLoading(false)
      }
    },
    [maxWorkers, handleSwarmEvent],
  )

  const stopSwarm = useCallback(async () => {
    if (!swarm) return

    try {
      eventSourceRef.current?.close()
      abortControllerRef.current?.abort()

      const serverUrl = await getAgentServerUrl()
      await fetch(`${serverUrl}/swarm/${swarm.id}`, {
        method: 'DELETE',
      })

      setSwarm((prev) =>
        prev
          ? { ...prev, status: 'terminated', completedAt: Date.now() }
          : null,
      )
    } catch {
      // Failed to stop swarm - ignore
    }
  }, [swarm])

  const arrangeWindows = useCallback(
    async (layout: 'grid' | 'cascade' | 'tile') => {
      if (!swarm) return

      try {
        const serverUrl = await getAgentServerUrl()
        await fetch(`${serverUrl}/swarm/${swarm.id}/arrange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout }),
        })
      } catch {
        // Failed to arrange windows - ignore
      }
    },
    [swarm],
  )

  const focusWorker = useCallback(
    async (workerId: string) => {
      if (!swarm) return

      try {
        const serverUrl = await getAgentServerUrl()
        await fetch(`${serverUrl}/swarm/${swarm.id}/worker/${workerId}/focus`, {
          method: 'POST',
        })
      } catch {
        // Failed to focus worker - ignore
      }
    },
    [swarm],
  )

  const terminateWorker = useCallback(
    async (workerId: string) => {
      if (!swarm) return

      try {
        const serverUrl = await getAgentServerUrl()
        await fetch(`${serverUrl}/swarm/${swarm.id}/worker/${workerId}`, {
          method: 'DELETE',
        })

        setSwarm((prev) => {
          if (!prev) return prev
          const workers = prev.workers.map((w) =>
            w.id === workerId
              ? { ...w, status: 'terminated' as WorkerStatus }
              : w,
          )
          return { ...prev, workers }
        })
      } catch {
        // Failed to terminate worker - ignore
      }
    },
    [swarm],
  )

  const reset = useCallback(() => {
    eventSourceRef.current?.close()
    abortControllerRef.current?.abort()
    setSwarm(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    swarm,
    isLoading,
    error,
    startSwarm,
    stopSwarm,
    arrangeWindows,
    focusWorker,
    terminateWorker,
    reset,
  }
}
