import { z } from 'zod'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { StorageManager } from '@/lib/runtime/StorageManager'
import { toolSuccess, toolError, type ToolOutput } from '@/lib/tools/Tool.interface'

// Input schema for storage operations
const StorageToolInputSchema = z.object({
  action: z.enum(['get', 'set']),  // Storage operation
  key: z.string().min(1).max(100),  // Storage key
  value: z.any().optional()  // Value to store (for set operation)
})

type StorageToolInput = z.infer<typeof StorageToolInputSchema>

export class StorageTool {
  constructor(private executionContext: ExecutionContext) {}
  
  async execute(input: StorageToolInput): Promise<ToolOutput> {
    const { action, key, value } = input
    
    try {
      if (action === 'set') {
        return await this._handleSet(key, value)
      } else {
        return await this._handleGet(key)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return toolError(`Storage operation failed: ${errorMessage}`)
    }
  }
  
  private async _handleSet(key: string, value: any): Promise<ToolOutput> {
    if (value === undefined) {
      return toolError('Value is required for set operation')
    }
    
    await StorageManager.set(key, value)
    return toolSuccess(`Stored value for key: ${key}`)
  }
  
  private async _handleGet(key: string): Promise<ToolOutput> {
    const value = await StorageManager.get(key)
    
    if (value === null) {
      return toolSuccess(`No value found for key: ${key}`)
    }
    
    // Return the value as JSON string
    return toolSuccess(JSON.stringify(value))
  }
}

// Factory function to create StorageTool
export function createStorageTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const storageTool = new StorageTool(executionContext)
  
  return new DynamicStructuredTool({
    name: 'storage_tool',
    description: 'Store and retrieve JSON values persistently using get/set operations',
    schema: StorageToolInputSchema,
    func: async (args: StorageToolInput): Promise<string> => {
      const result = await storageTool.execute(args)
      return JSON.stringify(result)
    }
  })
}