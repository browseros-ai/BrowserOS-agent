import { Logging } from '@/lib/utils/Logging'
import { MessageType } from '@/lib/types/messaging'
import { PubSub } from '@/lib/pubsub'
import { Subscription } from '@/lib/pubsub/types'

const DEFAULT_EXECUTION_ID = 'main'

interface PortInfo {
  port: chrome.runtime.Port
  executionId: string
  tabId?: number
  connectedAt: number
  subscription?: Subscription
}

/**
 * Port manager capable of handling multiple sidepanel instances.
 * Each port can subscribe to a distinct PubSub channel based on executionId.
 */
export class PortManager {
  private readonly ports = new Map<chrome.runtime.Port, PortInfo>()

  /**
   * Register a new port connection.
   */
  registerPort(port: chrome.runtime.Port): PortInfo {
    const tabId = port.sender?.tab?.id
    const inferredExecutionId =
      this.parseExecutionIdFromPortName(port.name) ??
      (typeof tabId === 'number' ? this.buildExecutionIdFromTab(tabId) : DEFAULT_EXECUTION_ID)

    const info: PortInfo = {
      port,
      executionId: inferredExecutionId,
      tabId,
      connectedAt: Date.now()
    }

    this.ports.set(port, info)

    if (port.name.startsWith('sidepanel')) {
      this.subscribeToChannel(info, inferredExecutionId)
    }

    this.notifyExecutionContext(info)

    Logging.log('PortManager', `Registered port ${port.name} (exec: ${inferredExecutionId})`)
    return info
  }

  /**
   * Update the execution channel associated with a port.
   */
  setPortExecution(port: chrome.runtime.Port, executionId: string, tabId?: number): void {
    const info = this.ports.get(port)
    if (!info) {
      Logging.log('PortManager', 'Attempted to update execution for unknown port', 'warning')
      return
    }

    if (typeof tabId === 'number') {
      info.tabId = tabId
    } else if (info.tabId === undefined && port.sender?.tab?.id !== undefined) {
      info.tabId = port.sender.tab.id
    }

    const needsResubscribe = info.executionId !== executionId || !info.subscription

    if (needsResubscribe) {
      this.subscribeToChannel(info, executionId)
      Logging.log('PortManager', `Updated port ${port.name} -> execution ${executionId}`)
      return
    }

    // Even if we're already subscribed, make sure the sidepanel knows the latest context
    this.notifyExecutionContext(info)
  }

  /**
   * Unregister a port (on disconnect).
   */
  unregisterPort(port: chrome.runtime.Port): void {
    const info = this.ports.get(port)
    if (!info) {
      return
    }

    if (info.subscription) {
      info.subscription.unsubscribe()
      info.subscription = undefined
    }

    this.ports.delete(port)
    Logging.log('PortManager', `Unregistered port ${port.name} (exec: ${info.executionId})`)
  }

  /**
   * Clean up all ports (e.g., on shutdown).
   */
  cleanup(): void {
    for (const info of this.ports.values()) {
      if (info.subscription) {
        info.subscription.unsubscribe()
      }
    }
    this.ports.clear()
  }

  getPortInfo(port: chrome.runtime.Port): PortInfo | undefined {
    return this.ports.get(port)
  }

  updateExecutionForTab(tabId: number, executionId: string): void {
    let updatedPorts = 0

    for (const info of this.ports.values()) {
      const isSidepanelPort = info.port.name.startsWith('sidepanel')
      const matchesTab = info.tabId === tabId
      const needsAssignment = isSidepanelPort && info.tabId === undefined
      const shouldUpdate = matchesTab || needsAssignment

      if (!shouldUpdate) {
        continue
      }

      Logging.log('PortManager', `Updating port ${info.port.name} to executionId ${executionId}`)
      this.subscribeToChannel(info, executionId)

      if (isSidepanelPort) {
        info.tabId = tabId
      }

      updatedPorts++
    }

    Logging.log('PortManager', `Updated ${updatedPorts} port(s) for tab ${tabId} -> execution ${executionId}`)
    this.debugPortState()
  }

  /**
   * Debug method to log current port state
   */
  private debugPortState(): void {
    Logging.log('PortManager', 'Current port state:')
    for (const info of this.ports.values()) {
      Logging.log('PortManager', `  Port: ${info.port.name}, TabId: ${info.tabId}, ExecutionId: ${info.executionId}`)
    }
  }

  /**
   * Subscribe a port to the specified execution channel.
   */
  private subscribeToChannel(info: PortInfo, executionId: string): void {
    if (info.subscription) {
      info.subscription.unsubscribe()
    }

    info.executionId = executionId

    const channel = PubSub.getChannel(executionId)
    info.subscription = channel.subscribe((event) => {
      try {
        info.port.postMessage({
          type: MessageType.AGENT_STREAM_UPDATE,
          payload: {
            executionId,
            event
          }
        })
      } catch (error) {
        Logging.log('PortManager', `Failed to forward event to ${executionId}: ${error}`, 'warning')
      }
    })

    this.notifyExecutionContext(info)
  }

  private parseExecutionIdFromPortName(name: string): string | undefined {
    if (!name) return undefined
    const separators = [':', '|', '/']
    for (const separator of separators) {
      const prefix = `sidepanel${separator}`
      if (name.startsWith(prefix)) {
        const executionId = name.slice(prefix.length)
        return executionId || undefined
      }
    }
    return undefined
  }

  private buildExecutionIdFromTab(tabId: number): string {
    return `tab-${tabId}`
  }

  private notifyExecutionContext(info: PortInfo): void {
    if (!info.port.name.startsWith('sidepanel')) {
      return
    }

    try {
      const contextPayload = {
        executionId: info.executionId,
        tabId: info.tabId
      }
      Logging.log('PortManager', `Sending EXECUTION_CONTEXT to ${info.port.name}: ${JSON.stringify(contextPayload)}`)

      info.port.postMessage({
        type: MessageType.EXECUTION_CONTEXT,
        payload: contextPayload
      })
    } catch (error) {
      Logging.log('PortManager', `Failed to notify execution context: ${error}`, 'warning')
    }
  }
}

