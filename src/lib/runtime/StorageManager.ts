/**
 * StorageManager handles persistent key-value storage for the agent
 * using chrome.storage.local with automatic JSON serialization
 */
export class StorageManager {
  private static readonly STORAGE_PREFIX = 'nxtscape_agent_'
  
  /**
   * Store a value with automatic JSON serialization
   */
  static async set(key: string, value: any): Promise<void> {
    const storageKey = this.STORAGE_PREFIX + key
    
    try {
      const serialized = JSON.stringify(value)
      await chrome.storage.local.set({ [storageKey]: serialized })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to store value: ${errorMessage}`)
    }
  }
  
  /**
   * Get a value with automatic JSON deserialization
   */
  static async get(key: string): Promise<any | null> {
    const storageKey = this.STORAGE_PREFIX + key
    
    try {
      const result = await chrome.storage.local.get(storageKey)
      const serialized = result[storageKey]
      
      if (serialized === undefined) {
        return null
      }
      
      return JSON.parse(serialized)
    } catch (error) {
      // If JSON parse fails, return null
      console.warn(`Failed to parse stored value for key ${key}:`, error)
      return null
    }
  }
  
  /**
   * Clear all agent storage
   */
  static async clearAll(): Promise<void> {
    const allKeys = await chrome.storage.local.get(null)
    const agentKeys = Object.keys(allKeys).filter(k => 
      k.startsWith(this.STORAGE_PREFIX)
    )
    
    if (agentKeys.length > 0) {
      await chrome.storage.local.remove(agentKeys)
    }
  }
}