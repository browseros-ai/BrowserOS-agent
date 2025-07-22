import { z } from 'zod'
import { AgentContext } from '../../core/AgentContext'
import { ToolDefinition, ToolResult } from './ToolConfig'

export abstract class Tool<TParams = any, TResult = any> {
  // Abstract methods that must be implemented by each tool
  abstract get definition(): ToolDefinition
  abstract get promptTemplate(): string
  
  protected abstract executeImpl(
    params: TParams, 
    context: AgentContext
  ): Promise<TResult>

  // Public execute method with validation and error handling
  async execute(params: unknown, context: AgentContext): Promise<ToolResult> {
    try {
      // Validate parameters against schema
      const validatedParams = this.validateParams(params)
      
      // Check if approval is required
      if (this.definition.requiresApproval) {
        const approved = await this.requestApproval(validatedParams, context)
        if (!approved) {
          return {
            success: false,
            result: null,
            error: 'Tool execution was not approved'
          }
        }
      }
      
      // Execute the tool
      const result = await this.executeImpl(validatedParams, context)
      
      return {
        success: true,
        result
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        result: null,
        error: errorMessage
      }
    }
  }

  // Validate parameters against the tool's schema
  protected validateParams(params: unknown): TParams {
    return this.definition.parameters.parse(params) as TParams
  }

  // Request approval for tool execution (can be overridden)
  protected async requestApproval(
    params: TParams, 
    context: AgentContext
  ): Promise<boolean> {
    // Default implementation - always approve
    // Override this in tools that need actual approval
    console.log(`Approval requested for ${this.definition.name} with params:`, params)
    return true
  }

  // Get tool info for LLM
  getToolInfo(): object {
    return {
      name: this.definition.name,
      description: this.definition.description,
      parameters: this.getParameterSchema()
    }
  }

  // Get JSON schema representation of parameters
  private getParameterSchema(): object {
    // Convert Zod schema to JSON schema format
    // This is a simplified version - in production, use a proper converter
    const schema = this.definition.parameters
    
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape
      const properties: Record<string, any> = {}
      const required: string[] = []
      
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodToJsonSchema(value as z.ZodSchema)
        if (!value.isOptional()) {
          required.push(key)
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      }
    }
    
    return { type: 'object' }
  }

  private zodToJsonSchema(schema: z.ZodSchema): any {
    if (schema instanceof z.ZodString) {
      return { type: 'string' }
    } else if (schema instanceof z.ZodNumber) {
      return { type: 'number' }
    } else if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' }
    } else if (schema instanceof z.ZodArray) {
      return { type: 'array', items: this.zodToJsonSchema(schema.element) }
    } else if (schema instanceof z.ZodObject) {
      return this.getParameterSchema()
    } else if (schema instanceof z.ZodEnum) {
      return { type: 'string', enum: schema.options }
    }
    
    return { type: 'string' }
  }
}