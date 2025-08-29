/**
 * Utility functions for parsing and handling port information
 */

export interface PortInfo {
  type: 'sidepanel' | 'newtab' | 'options' | 'unknown'
  tabId?: number
  executionId?: string
  raw: string
}

/**
 * Parse port name to extract structured information
 * 
 * Port name formats (executionId is always tab_<tabId>):
 * - sidepanel:<executionId>
 * - newtab:<executionId>
 * - options:<executionId>
 * 
 * @param portName - The port name to parse
 * @returns Parsed port information
 */
export function parsePortName(portName: string): PortInfo {
  const result: PortInfo = {
    type: 'unknown',
    raw: portName
  }

  // Check for sidepanel
  if (portName.startsWith('sidepanel:')) {
    const parts = portName.split(':')
    result.type = 'sidepanel'
    
    if (parts.length >= 2) {
      result.executionId = parts[1]
      // Extract tabId from executionId if it's in tab_<id> format
      if (parts[1].startsWith('tab_')) {
        const tabId = parseInt(parts[1].slice(4))
        if (!isNaN(tabId)) {
          result.tabId = tabId
        }
      }
    }
  }
  // Check for newtab with executionId (tab_<tabId>)
  else if (portName.startsWith('newtab:')) {
    const parts = portName.split(':')
    result.type = 'newtab'
    if (parts.length >= 2) {
      result.executionId = parts[1]
      // Extract tabId from executionId if it's in tab_<id> format
      if (parts[1].startsWith('tab_')) {
        const tabId = parseInt(parts[1].slice(4))
        if (!isNaN(tabId)) {
          result.tabId = tabId
        }
      }
    }
  }
  // Check for options
  else if (portName.startsWith('options:')) {
    const parts = portName.split(':')
    result.type = 'options'
    if (parts.length >= 2) {
      result.executionId = parts[1]
    }
  }

  return result
}

/**
 * Create a port name with the given parameters
 * Note: executionId should be in format tab_<tabId> for tab-scoped executions
 * 
 * @param type - The type of port
 * @param executionId - Execution ID (should be tab_<tabId> for tab contexts)
 * @returns Formatted port name
 */
export function createPortName(
  type: 'sidepanel' | 'newtab' | 'options',
  executionId: string
): string {
  // Simple format: type:executionId
  // Since executionId already contains tab info (tab_123), no need for redundancy
  return `${type}:${executionId}`
}