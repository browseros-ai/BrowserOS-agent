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
 * Port name formats:
 * - sidepanel:<tabId>:<executionId>
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

  // Check for sidepanel with dynamic format
  if (portName.startsWith('sidepanel:')) {
    const parts = portName.split(':')
    result.type = 'sidepanel'
    
    // Format: sidepanel:tabId:executionId
    if (parts.length >= 3) {
      const tabId = parseInt(parts[1])
      if (!isNaN(tabId)) {
        result.tabId = tabId
      }
      result.executionId = parts[2]
    }
    // Format without tabId: sidepanel:executionId (shouldn't happen but handle gracefully)
    else if (parts.length === 2) {
      result.executionId = parts[1]
    }
  }
  // Check for newtab with dynamic format
  else if (portName.startsWith('newtab:')) {
    const parts = portName.split(':')
    result.type = 'newtab'
    if (parts.length >= 2) {
      result.executionId = parts[1]
    }
  }
  // Check for options with dynamic format
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
 * 
 * @param type - The type of port
 * @param executionId - Execution ID (required)
 * @param tabId - Optional tab ID (for sidepanel only)
 * @returns Formatted port name
 */
export function createPortName(
  type: 'sidepanel' | 'newtab' | 'options',
  executionId: string,
  tabId?: number
): string {
  if (type === 'sidepanel' && tabId) {
    return `sidepanel:${tabId}:${executionId}`
  }
  if (type === 'sidepanel') {
    // This shouldn't happen - sidepanel should always have tabId
    console.warn('Creating sidepanel port without tab ID')
    return `sidepanel:${executionId}`
  }
  
  // For newtab and options
  return `${type}:${executionId}`
}