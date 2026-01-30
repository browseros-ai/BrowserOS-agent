/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * WorkerAgentManager - Creates and manages SwarmWorkerAgent instances
 *
 * Responsible for:
 * - Creating worker agents for spawned workers
 * - Starting task execution
 * - Cleaning up agents when done
 */

import type { ControllerBridge } from '../../browser/extension/bridge'
import { logger } from '../../lib/logger'
import { SWARM_TIMEOUTS } from '../constants'
import type { SwarmRegistry } from '../coordinator/swarm-registry'
import type { LLMProvider } from '../coordinator/task-planner'
import type { SwarmMessagingBus } from '../messaging/swarm-bus'
import type { Worker } from '../types'
import { createSwarmBrowserController } from './swarm-browser-controller'
import { SwarmWorkerAgent } from './swarm-worker-agent'

export interface WorkerAgentManagerDeps {
  bridge: ControllerBridge
  registry: SwarmRegistry
  messageBus: SwarmMessagingBus
  llmProvider: LLMProvider
}

export class WorkerAgentManager {
  private agents = new Map<string, SwarmWorkerAgent>()

  constructor(private deps: WorkerAgentManagerDeps) {}

  /**
   * Creates and starts a worker agent for the given worker.
   * This should be called after the worker window is created.
   */
  async startWorkerAgent(swarmId: string, worker: Worker): Promise<void> {
    if (!worker.windowId) {
      throw new Error(`Worker ${worker.id} has no windowId`)
    }

    logger.info('Starting worker agent', {
      swarmId,
      workerId: worker.id,
      windowId: worker.windowId,
      taskId: worker.task.id,
    })

    // Create browser controller for this specific window
    const browserController = createSwarmBrowserController(
      this.deps.bridge,
      worker.windowId,
    )

    // Create the worker agent
    const agent = new SwarmWorkerAgent(
      this.deps.messageBus,
      browserController,
      this.deps.llmProvider,
      {
        workerId: worker.id,
        swarmId,
        heartbeatIntervalMs: SWARM_TIMEOUTS.HEARTBEAT_INTERVAL_MS / 3, // More frequent to avoid timeout
        progressReportIntervalMs: 2000,
        maxActionRetries: 3,
        verbose: true,
      },
    )

    this.agents.set(worker.id, agent)

    // Update worker state to running
    this.deps.registry.updateWorkerState(swarmId, worker.id, 'running')

    // Start task execution by sending task_assign message
    // The agent listens for this message and starts execution
    this.deps.messageBus.sendToWorker(
      swarmId,
      worker.id,
      'task_assign',
      worker.task,
    )

    logger.info('Worker agent started and task assigned', {
      swarmId,
      workerId: worker.id,
      taskId: worker.task.id,
    })
  }

  /**
   * Starts all worker agents for a swarm.
   */
  async startAllWorkerAgents(swarmId: string): Promise<void> {
    const workers = this.deps.registry.getWorkers(swarmId)

    logger.info('Starting all worker agents', {
      swarmId,
      workerCount: workers.length,
    })

    // Start agents in parallel
    const startPromises = workers
      .filter((w) => w.windowId && w.state === 'pending')
      .map((worker) =>
        this.startWorkerAgent(swarmId, worker).catch((error) => {
          logger.error('Failed to start worker agent', {
            swarmId,
            workerId: worker.id,
            error,
          })
        }),
      )

    await Promise.all(startPromises)

    logger.info('All worker agents started', {
      swarmId,
      startedCount: startPromises.length,
    })
  }

  /**
   * Gets a worker agent by ID.
   */
  getAgent(workerId: string): SwarmWorkerAgent | undefined {
    return this.agents.get(workerId)
  }

  /**
   * Terminates a worker agent.
   */
  async terminateAgent(workerId: string): Promise<void> {
    const agent = this.agents.get(workerId)
    if (agent) {
      // Agent cleanup happens via terminate message handling
      this.agents.delete(workerId)
    }
  }

  /**
   * Terminates all agents for a swarm.
   */
  async terminateAllAgents(swarmId: string): Promise<void> {
    const workers = this.deps.registry.getWorkers(swarmId)

    for (const worker of workers) {
      await this.terminateAgent(worker.id)
    }

    logger.info('All worker agents terminated', {
      swarmId,
      terminatedCount: workers.length,
    })
  }

  /**
   * Cleans up all agents (for shutdown).
   */
  cleanup(): void {
    for (const [workerId] of this.agents) {
      this.agents.delete(workerId)
    }
  }
}
