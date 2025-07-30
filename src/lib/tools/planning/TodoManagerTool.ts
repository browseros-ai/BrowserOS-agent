import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { toolSuccess, toolError } from '@/lib/tools/Tool.interface'

// Input schema for TODO operations
const TodoInputSchema = z.object({
  action: z.enum(['list', 'add_multiple', 'complete_multiple', 'skip', 'replace_all']),  // Action to perform
  todos: z.array(z.object({ content: z.string() })).optional(),  // For add/replace actions
  ids: z.array(z.number().int()).optional()  // For complete/skip actions
})

type TodoInput = z.infer<typeof TodoInputSchema>

/**
 * Factory function to create TodoManagerTool
 */
export function createTodoManagerTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'todo_manager',
    description: 'Manage TODO list for complex tasks. Actions: list (returns current TODOs as XML), add_multiple (add new TODOs), complete_multiple (mark TODOs as done), skip (skip a single TODO by removing it - pass array with single ID), replace_all (clear and add new TODOs).',
    schema: TodoInputSchema,
    func: async (args: TodoInput): Promise<string> => {
      const todoStore = executionContext.todoStore
      
      try {
        let resultMessage = 'Success'
        
        switch (args.action) {
          case 'list':
            // Return XML representation of current TODOs
            return JSON.stringify({
              ok: true,
              output: todoStore.getXml()
            })
          
          case 'add_multiple':
            if (!args.todos || args.todos.length === 0) {
              throw new Error('todos array is required for add_multiple action')
            }
            todoStore.addMultiple(args.todos.map(t => t.content))
            resultMessage = `Added ${args.todos.length} TODOs`
            break
          
          case 'complete_multiple':
            if (!args.ids || args.ids.length === 0) {
              throw new Error('ids array is required for complete_multiple action')
            }
            todoStore.completeMultiple(args.ids)
            resultMessage = `Completed TODOs: ${args.ids.join(', ')}`
            break
          
          case 'skip':
            // Validate single ID only
            if (!args.ids || args.ids.length !== 1) {
              throw new Error('skip action requires exactly one ID in the ids array')
            }
            const skipId = args.ids[0]
            todoStore.skip(skipId)
            resultMessage = `Skipped TODO: ${skipId}`
            break
          
          case 'replace_all':
            if (!args.todos) {
              throw new Error('todos array is required for replace_all action')
            }
            todoStore.replaceAll(args.todos.map(t => t.content))
            resultMessage = `Replaced all TODOs with ${args.todos.length} new items`
            break
        }
        
        return JSON.stringify({
          ok: true,
          output: resultMessage
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return JSON.stringify(toolError(errorMessage))
      }
    }
  })
}