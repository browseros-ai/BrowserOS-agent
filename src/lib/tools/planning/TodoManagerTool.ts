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
 * Now properly syncs with ExecutionContext.todoStore for telemetry tracking
 */
export function createTodoManagerTool(executionContext: ExecutionContext): DynamicStructuredTool {
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
        switch (args.action) {
          case 'set':
            const markdownTodos = args.todos || ''
            
            // Parse markdown and sync with TodoStore for telemetry
            const lines = markdownTodos.split('\n').filter(line => line.trim())
            
            // Reset and rebuild TodoStore
            executionContext.todoStore.reset()
            
            // First pass: collect all todo contents
            const todoContents: string[] = []
            const completedIndexes: number[] = []
            
            lines.forEach((line, index) => {
              const pendingMatch = line.match(/^-\s*\[\s*\]\s*(.+)$/)
              const doneMatch = line.match(/^-\s*\[x\]\s*(.+)$/i)
              
              if (pendingMatch) {
                todoContents.push(pendingMatch[1].trim())
              } else if (doneMatch) {
                todoContents.push(doneMatch[1].trim())
                completedIndexes.push(todoContents.length) // 1-based index
              }
            })
            
            // Add all todos to store
            if (todoContents.length > 0) {
              executionContext.todoStore.addMultiple(todoContents)
              
              // Mark completed ones
              completedIndexes.forEach(index => {
                executionContext.todoStore.complete(index)
              })
            }
            
            return JSON.stringify({
              ok: true,
              output: 'Todos updated'
            })
          
          case 'get':
            // Build markdown from TodoStore
            const todos = executionContext.todoStore.getAll()
            const markdownLines = todos.map(todo => {
              const checkbox = todo.status === 'done' ? '[x]' : '[ ]'
              return `- ${checkbox} ${todo.content}`
            })
            
            return JSON.stringify({
              ok: true,
              output: markdownLines.join('\n') || ''
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
