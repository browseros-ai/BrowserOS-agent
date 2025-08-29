import { Logging } from '@/lib/utils/Logging'
import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { PubSub } from '@/lib/pubsub'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { Subscription } from '@/lib/pubsub/types'
import { parsePortName } from '../utils/portUtils'

// Port info stored for each connection
interface PortInfo {
  port: chrome.runtime.Port
  executionId?: string
  connectedAt: number
  subscription?: Subscription
}

/**
 * Manages port connections and lifecycle.
 * Maps executionIds to ports and handles PubSub forwarding.
 */
export class PortManager {
  private ports: Map<string, PortInfo> = new Map()
  private executionPorts: Map<string, Set<string>> = new Map() // executionId -> Set of port IDs

  /**
   * Register a new port connection
   */
  registerPort(port: chrome.runtime.Port): string {
    const portId = this.generatePortId(port)
    const parsedPortInfo = parsePortName(port.name)
    const executionId = parsedPortInfo.executionId
    
    // Store port info
    const portInfo: PortInfo = {
      port,
      executionId,
      connectedAt: Date.now()
    }
    
    // If this port has an executionId, subscribe to its PubSub channel
    if (executionId) {
      const channel = PubSub.getChannel(executionId)
      portInfo.subscription = this.subscribeToChannel(channel, port, executionId)
      
      // Track execution -> ports mapping
      if (!this.executionPorts.has(executionId)) {
        this.executionPorts.set(executionId, new Set())
      }
      this.executionPorts.get(executionId)!.add(portId)
    }
    
    this.ports.set(portId, portInfo)
    
    Logging.log('PortManager', 
      `Registered port ${portId} (${port.name})${executionId ? ` for execution ${executionId}` : ''}`)
    
    return portId
  }

  /**
   * Subscribe to a PubSub channel and forward events to port
   */
  private subscribeToChannel(
    channel: PubSubChannel,
    port: chrome.runtime.Port,
    executionId: string
  ): Subscription {
    return channel.subscribe((event) => {
      try {
        // Forward PubSub events to the port as AGENT_STREAM_UPDATE messages
        port.postMessage({
          type: MessageType.AGENT_STREAM_UPDATE,
          payload: {
            executionId,
            event
          }
        })
      } catch (error) {
        // Port might be disconnected
        Logging.log('PortManager', 
          `Failed to forward event to port: ${error}`, 'warning')
      }
    })
  }

  /**
   * Unregister a port (on disconnect)
   */
  unregisterPort(port: chrome.runtime.Port): void {
    const portId = this.generatePortId(port)
    const portInfo = this.ports.get(portId)
    
    if (!portInfo) {
      return
    }
    
    // Unsubscribe from PubSub if subscribed
    if (portInfo.subscription) {
      portInfo.subscription.unsubscribe()
    }
    
    // Remove from execution mapping
    if (portInfo.executionId) {
      const execPorts = this.executionPorts.get(portInfo.executionId)
      if (execPorts) {
        execPorts.delete(portId)
        if (execPorts.size === 0) {
          this.executionPorts.delete(portInfo.executionId)
        }
      }
    }
    
    // Remove port info
    this.ports.delete(portId)
    
    Logging.log('PortManager', 
      `Unregistered port ${portId} (${port.name})${portInfo.executionId ? ` for execution ${portInfo.executionId}` : ''}`)
  }

  /**
   * Get port info by port object
   */
  getPortInfo(port: chrome.runtime.Port): PortInfo | undefined {
    const portId = this.generatePortId(port)
    return this.ports.get(portId)
  }

  /**
   * Get all ports for an execution
   */
  getExecutionPorts(executionId: string): chrome.runtime.Port[] {
    const portIds = this.executionPorts.get(executionId)
    if (!portIds) return []
    
    const ports: chrome.runtime.Port[] = []
    for (const portId of portIds) {
      const portInfo = this.ports.get(portId)
      if (portInfo) {
        ports.push(portInfo.port)
      }
    }
    return ports
  }

  /**
   * Send message to all ports of an execution
   */
  broadcastToExecution(executionId: string, message: PortMessage): void {
    const ports = this.getExecutionPorts(executionId)
    for (const port of ports) {
      try {
        port.postMessage(message)
      } catch (error) {
        // Port might be disconnected
        Logging.log('PortManager', `Failed to send message to port: ${error}`, 'warning')
      }
    }
  }


  /**
   * Generate a unique ID for a port
   */
  private generatePortId(port: chrome.runtime.Port): string {
    // Use port name and sender info to create unique ID
    const sender = port.sender
    const tabId = sender?.tab?.id || 'notab'
    const frameId = sender?.frameId || 0
    return `${port.name}_${tabId}_${frameId}_${Date.now()}`
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalPorts: number
    executionCount: number
    portsPerExecution: Record<string, number>
  } {
    const portsPerExecution: Record<string, number> = {}
    for (const [execId, portSet] of this.executionPorts) {
      portsPerExecution[execId] = portSet.size
    }
    
    return {
      totalPorts: this.ports.size,
      executionCount: this.executionPorts.size,
      portsPerExecution
    }
  }

  /**
   * Clean up all ports
   */
  cleanup(): void {
    // Unsubscribe all
    for (const portInfo of this.ports.values()) {
      if (portInfo.subscription) {
        portInfo.subscription.unsubscribe()
      }
    }
    
    // Clear maps
    this.ports.clear()
    this.executionPorts.clear()
  }
}