import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { PubSub } from '@/lib/pubsub'

// Simple schema - just action and optional markdown todos
const TodoInputSchema = z.object({
  action: z.enum(['set', 'get']),  // Only two actions: set the list or get the list
  todos: z.string().optional()  // Markdown string for 'set' action
})

type TodoInput = z.infer<typeof TodoInputSchema>

/**
 * Simplified TodoManagerTool that stores and retrieves markdown TODO lists
 * The LLM manages all state - we just store/retrieve the markdown string
 */
export function createTodoManagerTool(executionContext: ExecutionContext): DynamicStructuredTool {
  // Simple in-memory storage for the markdown TODO list
  let markdownTodos = ''
  
  return new DynamicStructuredTool({
    name: 'todo_manager_tool',
    description: `Manage a simple TODO list using markdown checkboxes.
Actions:
- 'set': Update the entire list with markdown format (- [ ] for pending, - [x] for done)
- 'get': Retrieve the current markdown list
Keep todos single-level without nesting.`,
    schema: TodoInputSchema,
    func: async (args: TodoInput): Promise<string> => {
      try {
        const resultMessage = 'Success'
        
        switch (args.action) {
          case 'set':
            // Store the markdown string as-is
            markdownTodos = args.todos || ''
            return JSON.stringify({
              ok: true,
              output: 'Todos updated'
            })
          
          case 'get':
            // Return the stored markdown string
            return JSON.stringify({
              ok: true,
              output: markdownTodos
            })
            
          default:
            return JSON.stringify({
              ok: false,
              output: 'Invalid action'
            })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return JSON.stringify({
          ok: false,
          output: errorMessage
        })
      }
    }
  })
}
