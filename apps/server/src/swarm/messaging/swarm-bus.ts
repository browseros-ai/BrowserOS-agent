/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmMessagingBus - Event-based messaging for swarm communication
 *
 * Enables communication between master and worker agents using
 * an EventEmitter-based pub/sub pattern.
 */

import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { logger } from '../../lib/logger'
import { SWARM_IDS } from '../constants'
import type { SwarmMessage, SwarmMessageType } from '../types'

export type MessageHandler = (message: SwarmMessage) => void | Promise<void>
export type Unsubscribe = () => void

/**
 * Channel naming convention:
 * - swarm:{swarmId}:master - Messages to master from any worker
 * - swarm:{swarmId}:worker:{workerId} - Messages to specific worker
 * - swarm:{swarmId}:broadcast - Messages to all workers
 */
function getChannel(swarmId: string, targetId: string): string {
  if (targetId === SWARM_IDS.MASTER) {
    return `swarm:${swarmId}:master`
  }
  if (targetId === SWARM_IDS.BROADCAST) {
    return `swarm:${swarmId}:broadcast`
  }
  return `swarm:${swarmId}:worker:${targetId}`
}

export class SwarmMessagingBus {
  private emitter = new EventEmitter()

  constructor() {
    // Increase max listeners for swarms with many workers
    this.emitter.setMaxListeners(100)
  }

  /**
   * Creates a new message with auto-generated ID and timestamp.
   */
  createMessage(
    swarmId: string,
    senderId: string,
    targetId: string,
    type: SwarmMessageType,
    payload: unknown,
  ): SwarmMessage {
    return {
      id: randomUUID(),
      timestamp: Date.now(),
      swarmId,
      senderId,
      targetId,
      type,
      payload,
    }
  }

  /**
   * Sends a message to a specific target.
   */
  send(message: SwarmMessage): void {
    const channel = getChannel(message.swarmId, message.targetId)

    logger.debug('Sending swarm message', {
      channel,
      type: message.type,
      senderId: message.senderId,
      targetId: message.targetId,
    })

    this.emitter.emit(channel, message)

    // Also emit to broadcast if not already a broadcast
    if (message.targetId !== SWARM_IDS.BROADCAST) {
      // Subscribers to broadcast can optionally receive all messages
      this.emitter.emit(`swarm:${message.swarmId}:all`, message)
    }
  }

  /**
   * Sends a message from master to a specific worker.
   */
  sendToWorker(
    swarmId: string,
    workerId: string,
    type: SwarmMessageType,
    payload: unknown,
  ): void {
    const message = this.createMessage(
      swarmId,
      SWARM_IDS.MASTER,
      workerId,
      type,
      payload,
    )
    this.send(message)
  }

  /**
   * Broadcasts a message from master to all workers.
   */
  broadcast(swarmId: string, type: SwarmMessageType, payload: unknown): void {
    const message = this.createMessage(
      swarmId,
      SWARM_IDS.MASTER,
      SWARM_IDS.BROADCAST,
      type,
      payload,
    )
    const channel = getChannel(swarmId, SWARM_IDS.BROADCAST)
    this.emitter.emit(channel, message)
  }

  /**
   * Sends a message from a worker to master.
   */
  sendToMaster(
    swarmId: string,
    workerId: string,
    type: SwarmMessageType,
    payload: unknown,
  ): void {
    const message = this.createMessage(
      swarmId,
      workerId,
      SWARM_IDS.MASTER,
      type,
      payload,
    )
    this.send(message)
  }

  /**
   * Subscribes to messages for a specific target.
   */
  subscribe(
    swarmId: string,
    targetId: string,
    handler: MessageHandler,
  ): Unsubscribe {
    const channel = getChannel(swarmId, targetId)

    logger.debug('Subscribing to swarm channel', { channel, targetId })

    this.emitter.on(channel, handler)

    return () => {
      this.emitter.off(channel, handler)
      logger.debug('Unsubscribed from swarm channel', { channel })
    }
  }

  /**
   * Subscribes to all messages in a swarm (for monitoring).
   */
  subscribeAll(swarmId: string, handler: MessageHandler): Unsubscribe {
    const channel = `swarm:${swarmId}:all`
    this.emitter.on(channel, handler)

    return () => {
      this.emitter.off(channel, handler)
    }
  }

  /**
   * Subscribes to broadcast messages.
   */
  subscribeBroadcast(swarmId: string, handler: MessageHandler): Unsubscribe {
    return this.subscribe(swarmId, SWARM_IDS.BROADCAST, handler)
  }

  /**
   * Subscribes to messages sent to master.
   */
  subscribeToMaster(swarmId: string, handler: MessageHandler): Unsubscribe {
    return this.subscribe(swarmId, SWARM_IDS.MASTER, handler)
  }

  /**
   * Waits for a specific message type with timeout.
   */
  async waitFor(
    swarmId: string,
    targetId: string,
    type: SwarmMessageType,
    timeoutMs: number,
  ): Promise<SwarmMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe()
        reject(new Error(`Timeout waiting for message type: ${type}`))
      }, timeoutMs)

      const unsubscribe = this.subscribe(swarmId, targetId, (message) => {
        if (message.type === type) {
          clearTimeout(timeout)
          unsubscribe()
          resolve(message)
        }
      })
    })
  }

  /**
   * Removes all listeners for a swarm (cleanup).
   */
  removeSwarmListeners(swarmId: string): void {
    const patterns = [
      `swarm:${swarmId}:master`,
      `swarm:${swarmId}:broadcast`,
      `swarm:${swarmId}:all`,
    ]

    for (const pattern of patterns) {
      this.emitter.removeAllListeners(pattern)
    }

    // Remove worker-specific listeners
    const allEvents = this.emitter.eventNames()
    for (const event of allEvents) {
      if (typeof event === 'string' && event.startsWith(`swarm:${swarmId}:`)) {
        this.emitter.removeAllListeners(event)
      }
    }

    logger.debug('Removed all listeners for swarm', { swarmId })
  }

  /**
   * Gets listener count for debugging.
   */
  getListenerCount(swarmId: string): number {
    const allEvents = this.emitter.eventNames()
    let count = 0

    for (const event of allEvents) {
      if (typeof event === 'string' && event.startsWith(`swarm:${swarmId}:`)) {
        count += this.emitter.listenerCount(event)
      }
    }

    return count
  }
}
