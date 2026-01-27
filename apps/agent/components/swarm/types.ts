/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Swarm Types - Shared types for swarm UI components
 */

export type SwarmStatus = 'idle' | 'planning' | 'spawning' | 'executing' | 'aggregating' | 'completed' | 'failed' | 'terminated'
export type WorkerStatus = 'pending' | 'spawning' | 'ready' | 'executing' | 'completed' | 'failed' | 'terminated'

export interface SwarmWorker {
  id: string
  windowId?: number
  tabId?: number
  status: WorkerStatus
  task?: string
  progress: number
  startedAt?: number
  completedAt?: number
  error?: string
  result?: string
  screenshots?: string[]
}

export interface SwarmState {
  id: string
  status: SwarmStatus
  task: string
  workers: SwarmWorker[]
  progress: number
  startedAt: number
  completedAt?: number
  result?: string
  error?: string
  metrics?: {
    totalDurationMs?: number
    workerDurations?: Record<string, number>
    successRate?: number
  }
}

export interface SwarmEvent {
  type: 'status' | 'worker_update' | 'progress' | 'result' | 'error' | 'complete'
  swarmId: string
  timestamp: number
  data: unknown
}
