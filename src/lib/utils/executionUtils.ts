/**
 * Get execution ID for the current context or a specific tab
 */
export async function getExecutionId(tabId?: number): Promise<string> {
  if (tabId !== undefined) {
    return `tab_${tabId}`
  }
  
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!activeTab?.id) {
      throw new Error('No active tab found to generate execution ID')
    }
    
    return `tab_${activeTab.id}`
  } catch (error) {
    console.error('Failed to get tab for execution ID:', error)
    throw new Error('Unable to generate execution ID: ' + (error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Extract tab ID from an execution ID
 */
export function getTabIdFromExecutionId(executionId: string): number | null {
  if (!executionId.startsWith('tab_')) {
    return null
  }
  
  const tabIdStr = executionId.slice(4)
  const tabId = parseInt(tabIdStr, 10)
  
  return isNaN(tabId) ? null : tabId
}

/**
 * Check if an execution ID is tab-scoped
 */
export function isTabExecution(executionId: string): boolean {
  return executionId.startsWith('tab_')
}

/**
 * Validate an execution ID format
 */
export function isValidExecutionId(executionId: string): boolean {
  if (!executionId.startsWith('tab_')) {
    return false
  }
  
  const tabId = getTabIdFromExecutionId(executionId)
  return tabId !== null && tabId > 0
}
