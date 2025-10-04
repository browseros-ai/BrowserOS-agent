import { Logging } from '@/lib/utils/Logging'
import { MessageType } from '@/lib/types/messaging'
import { PubSub } from '@/lib/pubsub'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { Subscription } from '@/lib/pubsub/types'

// Simplified port info for singleton
interface PortInfo {
  port: chrome.runtime.Port
  connectedAt: number
  subscription?: Subscription
}

/**
 * Simple port manager for singleton architecture
 */
export class PortManager {
  private ports: Map<string, PortInfo> = new Map()
  private mainChannel: PubSubChannel

  constructor() {
    // Get the singleton PubSub channel
    this.mainChannel = PubSub.getChannel('main')
  }

  /**
   * Register a new port connection
   */
  registerPort(port: chrome.runtime.Port): string {
    const portId = port.name  // Just use port name as ID
    
    // Store port info
    const info: PortInfo = {
      port,
      connectedAt: Date.now()
    }
    
    // Subscribe sidepanel to PubSub events
    if (port.name === 'sidepanel') {
      info.subscription = this.subscribeToChannel(port)
    }
    
    this.ports.set(portId, info)

    // Only log registration for sidepanel, not temporary options connections
    if (port.name === 'sidepanel') {
      Logging.log('PortManager', `Registered ${port.name} port`)
    }

    return portId
  }

  /**
   * Subscribe to PubSub channel and forward events to port
   */
  private subscribeToChannel(port: chrome.runtime.Port): Subscription {
    return this.mainChannel.subscribe((event) => {
      try {
        // Forward PubSub events to the port
        port.postMessage({
          type: MessageType.AGENT_STREAM_UPDATE,
          payload: {
            executionId: 'main',
            event
          }
        })
      } catch (error) {
        // Port might be disconnected
        Logging.log('PortManager', `Failed to forward event: ${error}`, 'warning')
      }
    })
  }

  /**
   * Unregister a port (on disconnect)
   */
  unregisterPort(port: chrome.runtime.Port): void {
    const portId = port.name
    const portInfo = this.ports.get(portId)
    
    if (!portInfo) {
      return
    }
    
    // Unsubscribe from PubSub if subscribed
    if (portInfo.subscription) {
      portInfo.subscription.unsubscribe()
    }
    
    // Remove port info
    this.ports.delete(portId)

    // Only log disconnection for sidepanel, not temporary options connections
    if (port.name === 'sidepanel') {
      Logging.log('PortManager', `Unregistered ${port.name} port`)
    }
  }

  /**
   * Get port info by port object
   */
  getPortInfo(port: chrome.runtime.Port): PortInfo | undefined {
    return this.ports.get(port.name)
  }

  /**
   * Get all connected ports
   */
  getAllPorts(): chrome.runtime.Port[] {
    return Array.from(this.ports.values()).map(info => info.port)
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
    
    // Clear map
    this.ports.clear()
  }
}
