import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { toolSuccess, toolError } from '@/lib/tools/Tool.interface'

// Input schema for TODO operations
const TodoInputSchema = z.object({
  action: z.enum(['list', 'add_multiple', 'complete', 'skip', 'go_back', 'replace_all', 'get_next']),  // Action to perform
  todos: z.array(z.object({ content: z.string() })).optional(),  // For add/replace actions
  ids: z.array(z.number().int()).optional()  // For complete/skip/go_back actions
})

type TodoInput = z.infer<typeof TodoInputSchema>

/**
 * Factory function to create TodoManagerTool
 */
export function createTodoManagerTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'todo_manager_tool',
    description: 'Manage TODO list for complex tasks. Actions: list (returns current TODOs as XML), get_next (get next TODO to work on), add_multiple (add new TODOs), complete (mark a single TODO as done - pass array with single ID), skip (skip a single TODO by removing it - pass array with single ID), go_back (mark a TODO and all subsequent ones as not done - pass array with single ID), replace_all (clear and add new TODOs).',
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
          
          case 'complete':
            // Validate single ID only
            if (!args.ids || args.ids.length !== 1) {
              throw new Error('complete action requires exactly one ID in the ids array')
            }
            const completeId = args.ids[0]
            todoStore.complete(completeId)
            resultMessage = `Completed TODO: ${completeId}`
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
          
          case 'go_back':
            // Validate single ID only
            if (!args.ids || args.ids.length !== 1) {
              throw new Error('go_back action requires exactly one ID in the ids array')
            }
            const goBackId = args.ids[0]
            todoStore.goBack(goBackId)
            resultMessage = `Went back to TODO: ${goBackId} and marked it and all subsequent TODOs as not done`
            break
          
          case 'replace_all':
            if (!args.todos) {
              throw new Error('todos array is required for replace_all action')
            }
            todoStore.replaceAll(args.todos.map(t => t.content))
            resultMessage = `Replaced all TODOs with ${args.todos.length} new items`
            break
          
          case 'get_next':
            const nextTodo = todoStore.getNextTodo()
            if (!nextTodo) {
              return JSON.stringify({
                ok: true,
                output: null,
                message: 'No more TODOs to execute'
              })
            }
            return JSON.stringify({
              ok: true,
              output: {
                id: nextTodo.id,
                content: nextTodo.content,
                status: nextTodo.status
              }
            })
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