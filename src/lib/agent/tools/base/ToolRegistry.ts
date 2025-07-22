import { Tool } from './Tool'
import { Logging } from '@/lib/utils/Logging'

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private static instance: ToolRegistry

  // Singleton pattern for global tool registry
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry()
    }
    return ToolRegistry.instance
  }

  // Register a tool
  register(tool: Tool): void {
    const name = tool.definition.name
    
    if (this.tools.has(name)) {
      Logging.log('ToolRegistry', `Warning: Overwriting existing tool: ${name}`, 'warn')
    }
    
    this.tools.set(name, tool)
    Logging.log('ToolRegistry', `Registered tool: ${name}`)
  }

  // Register multiple tools
  registerMany(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  // Get a tool by name
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  // Check if a tool exists
  has(name: string): boolean {
    return this.tools.has(name)
  }

  // Get all registered tools
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  // Get all tool names
  getNames(): string[] {
    return Array.from(this.tools.keys())
  }

  // Get tool info for LLM
  getToolInfoForLLM(): object[] {
    return this.getAll().map(tool => tool.getToolInfo())
  }

  // Clear all tools
  clear(): void {
    this.tools.clear()
  }

  // Remove a specific tool
  remove(name: string): boolean {
    return this.tools.delete(name)
  }
}