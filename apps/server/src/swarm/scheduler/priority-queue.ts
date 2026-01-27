/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PriorityTaskQueue - Advanced task scheduling with priorities
 *
 * Implements a priority-based task queue with dependency resolution,
 * fair scheduling, and deadline awareness.
 */

import { EventEmitter } from 'node:events'
import { logger } from '../../lib/logger'
import type { WorkerTask } from '../types'

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

export interface ScheduledTask extends WorkerTask {
  priority: TaskPriority
  deadline?: number
  estimatedDurationMs?: number
  addedAt: number
  scheduledAt?: number
  assignedWorkerId?: string
  /** Resolved dependencies (ready to execute) */
  dependenciesResolved: boolean
  /** Number of times task was preempted */
  preemptCount: number
  /** Original position for fairness */
  originalPosition: number
}

interface QueueStats {
  totalTasks: number
  pendingTasks: number
  scheduledTasks: number
  byPriority: Record<TaskPriority, number>
  avgWaitTimeMs: number
  oldestTaskAgeMs: number
}

const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  critical: 1000,
  high: 100,
  normal: 10,
  low: 1,
  background: 0.1,
}

/** Aging factor - tasks gain priority over time */
const AGING_FACTOR_PER_MINUTE = 5

/** Deadline urgency boost */
const DEADLINE_URGENCY_MULTIPLIER = 2

export class PriorityTaskQueue extends EventEmitter {
  private tasks = new Map<string, ScheduledTask>()
  private taskOrder: string[] = []
  private positionCounter = 0

  /**
   * Adds a task to the queue with priority.
   */
  enqueue(
    task: WorkerTask,
    priority: TaskPriority = 'normal',
    options: {
      deadline?: number
      estimatedDurationMs?: number
    } = {},
  ): ScheduledTask {
    const scheduledTask: ScheduledTask = {
      ...task,
      priority,
      deadline: options.deadline,
      estimatedDurationMs: options.estimatedDurationMs,
      addedAt: Date.now(),
      dependenciesResolved: !task.dependencies?.length,
      preemptCount: 0,
      originalPosition: this.positionCounter++,
    }

    this.tasks.set(task.id, scheduledTask)
    this.taskOrder.push(task.id)
    this.rebalance()

    logger.debug('Task enqueued', {
      taskId: task.id,
      priority,
      queueSize: this.tasks.size,
    })

    this.emit('task_enqueued', scheduledTask)

    return scheduledTask
  }

  /**
   * Enqueues multiple tasks, resolving dependencies.
   */
  enqueueBatch(
    tasks: WorkerTask[],
    priority: TaskPriority = 'normal',
  ): ScheduledTask[] {
    const scheduled: ScheduledTask[] = []

    for (const task of tasks) {
      scheduled.push(this.enqueue(task, priority))
    }

    // Resolve initial dependencies
    this.resolveDependencies()

    return scheduled
  }

  /**
   * Dequeues the highest priority task that's ready.
   */
  dequeue(): ScheduledTask | undefined {
    this.rebalance()

    // Find first task with resolved dependencies
    for (const taskId of this.taskOrder) {
      const task = this.tasks.get(taskId)
      if (task && task.dependenciesResolved && !task.scheduledAt) {
        task.scheduledAt = Date.now()
        this.emit('task_scheduled', task)
        return task
      }
    }

    return undefined
  }

  /**
   * Dequeues up to N tasks.
   */
  dequeueN(count: number): ScheduledTask[] {
    const tasks: ScheduledTask[] = []

    for (let i = 0; i < count; i++) {
      const task = this.dequeue()
      if (!task) break
      tasks.push(task)
    }

    return tasks
  }

  /**
   * Peeks at the next task without dequeuing.
   */
  peek(): ScheduledTask | undefined {
    this.rebalance()

    for (const taskId of this.taskOrder) {
      const task = this.tasks.get(taskId)
      if (task && task.dependenciesResolved && !task.scheduledAt) {
        return task
      }
    }

    return undefined
  }

  /**
   * Marks a task as complete and resolves dependents.
   */
  complete(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    this.tasks.delete(taskId)
    this.taskOrder = this.taskOrder.filter((id) => id !== taskId)

    // Resolve dependencies
    this.resolveDependencies()

    this.emit('task_completed', task)
  }

  /**
   * Marks a task as failed.
   */
  fail(taskId: string, error: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    this.tasks.delete(taskId)
    this.taskOrder = this.taskOrder.filter((id) => id !== taskId)

    // Mark dependents as blocked
    for (const [, t] of this.tasks) {
      if (t.dependencies?.includes(taskId)) {
        t.dependenciesResolved = false
      }
    }

    this.emit('task_failed', { task, error })
  }

  /**
   * Preempts a task, returning it to the queue with boosted priority.
   */
  preempt(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.scheduledAt = undefined
    task.preemptCount++

    // Boost priority for preempted tasks (fairness)
    if (task.priority !== 'critical') {
      const priorities: TaskPriority[] = [
        'background',
        'low',
        'normal',
        'high',
        'critical',
      ]
      const currentIndex = priorities.indexOf(task.priority)
      if (currentIndex < priorities.length - 1) {
        task.priority = priorities[currentIndex + 1]
      }
    }

    this.rebalance()
    this.emit('task_preempted', task)
  }

  /**
   * Resolves dependencies for all tasks.
   */
  private resolveDependencies(): void {
    const completedIds = new Set<string>()

    // Find all completed tasks (not in queue)
    for (const taskId of this.taskOrder) {
      if (!this.tasks.has(taskId)) {
        completedIds.add(taskId)
      }
    }

    // Mark tasks with all dependencies met
    for (const [, task] of this.tasks) {
      if (!task.dependencies?.length) {
        task.dependenciesResolved = true
        continue
      }

      const allDepsComplete = task.dependencies.every((depId) => {
        // Dependency is complete if not in queue
        return !this.tasks.has(depId)
      })

      if (allDepsComplete && !task.dependenciesResolved) {
        task.dependenciesResolved = true
        this.emit('dependencies_resolved', task)
      }
    }
  }

  /**
   * Rebalances the queue based on dynamic priority scores.
   */
  private rebalance(): void {
    const now = Date.now()

    // Calculate dynamic scores
    const scored = this.taskOrder.map((taskId) => {
      const task = this.tasks.get(taskId)
      if (!task) return { taskId, score: -Infinity }

      let score = PRIORITY_WEIGHTS[task.priority]

      // Age bonus (tasks waiting longer get priority)
      const ageMinutes = (now - task.addedAt) / 60_000
      score += ageMinutes * AGING_FACTOR_PER_MINUTE

      // Deadline urgency
      if (task.deadline) {
        const timeToDeadline = task.deadline - now
        if (timeToDeadline < 0) {
          // Past deadline - critical priority
          score += 10000
        } else if (timeToDeadline < 60_000) {
          // Within 1 minute
          score *= DEADLINE_URGENCY_MULTIPLIER * 2
        } else if (timeToDeadline < 300_000) {
          // Within 5 minutes
          score *= DEADLINE_URGENCY_MULTIPLIER
        }
      }

      // Preempt bonus (fairness)
      score += task.preemptCount * 50

      // Dependencies penalty (prefer tasks with resolved deps)
      if (!task.dependenciesResolved) {
        score -= 1000
      }

      // Already scheduled penalty (shouldn't reorder)
      if (task.scheduledAt) {
        score -= 5000
      }

      return { taskId, score }
    })

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score)

    this.taskOrder = scored.map((s) => s.taskId)
  }

  /**
   * Assigns a worker to a task.
   */
  assignWorker(taskId: string, workerId: string): void {
    const task = this.tasks.get(taskId)
    if (task) {
      task.assignedWorkerId = workerId
    }
  }

  /**
   * Gets queue statistics.
   */
  getStats(): QueueStats {
    const now = Date.now()
    const allTasks = Array.from(this.tasks.values())
    const pendingTasks = allTasks.filter((t) => !t.scheduledAt)
    const scheduledTasks = allTasks.filter((t) => t.scheduledAt)

    const byPriority: Record<TaskPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0,
    }

    let totalWaitTime = 0
    let oldestAge = 0

    for (const task of allTasks) {
      byPriority[task.priority]++

      const age = now - task.addedAt
      totalWaitTime += age
      if (age > oldestAge) oldestAge = age
    }

    return {
      totalTasks: allTasks.length,
      pendingTasks: pendingTasks.length,
      scheduledTasks: scheduledTasks.length,
      byPriority,
      avgWaitTimeMs: allTasks.length > 0 ? totalWaitTime / allTasks.length : 0,
      oldestTaskAgeMs: oldestAge,
    }
  }

  /**
   * Gets the current queue size.
   */
  size(): number {
    return this.tasks.size
  }

  /**
   * Checks if queue is empty.
   */
  isEmpty(): boolean {
    return this.tasks.size === 0
  }

  /**
   * Clears the queue.
   */
  clear(): void {
    this.tasks.clear()
    this.taskOrder = []
    this.emit('queue_cleared')
  }

  /**
   * Gets tasks by priority.
   */
  getByPriority(priority: TaskPriority): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.priority === priority,
    )
  }

  /**
   * Upgrades task priority.
   */
  upgradePriority(taskId: string, newPriority: TaskPriority): void {
    const task = this.tasks.get(taskId)
    if (task && PRIORITY_WEIGHTS[newPriority] > PRIORITY_WEIGHTS[task.priority]) {
      task.priority = newPriority
      this.rebalance()
      this.emit('priority_upgraded', task)
    }
  }
}
