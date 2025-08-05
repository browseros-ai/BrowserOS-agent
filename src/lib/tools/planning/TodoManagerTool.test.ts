import { describe, it, expect, vi } from 'vitest'
import { createTodoManagerTool } from './TodoManagerTool'
import { TodoStore } from '@/lib/runtime/TodoStore'

describe('TodoManagerTool', () => {
  // Create a minimal mock of ExecutionContext for testing
  const createMockExecutionContext = () => {
    const todoStore = new TodoStore()
    
    return {
      todoStore,
      mockContext: {
        todoStore
      } as any
    }
  }

  it('tests that the tool can be created with required dependencies', () => {
    const { mockContext } = createMockExecutionContext()
    const tool = createTodoManagerTool(mockContext)

    // Verify tool is created properly
    expect(tool).toBeDefined()
    expect(tool.name).toBe('todo_manager_tool')
    expect(tool.description).toContain('Manage TODO list for complex tasks')
    expect(typeof tool.func).toBe('function')
  })

  it('tests that list action returns XML format', async () => {
    const { todoStore, mockContext } = createMockExecutionContext()
    const tool = createTodoManagerTool(mockContext)
    
    // Add some test todos to the store
    todoStore.addMultiple(['First task', 'Second task'])
    
    // Execute list action
    const result = await tool.func({ action: 'list' })
    const parsed = JSON.parse(result)
    
    // Verify successful response
    expect(parsed.ok).toBe(true)
    expect(parsed.output).toBeDefined()
    
    // Verify XML format
    expect(parsed.output).toContain('<todos>')
    expect(parsed.output).toContain('</todos>')
    expect(parsed.output).toContain('<todo id="1" status="todo">First task</todo>')
    expect(parsed.output).toContain('<todo id="2" status="todo">Second task</todo>')
  })

  it('tests that skip action validates single ID only', async () => {
    const { todoStore, mockContext } = createMockExecutionContext()
    const tool = createTodoManagerTool(mockContext)
    
    // Add some test todos
    todoStore.addMultiple(['Task 1', 'Task 2', 'Task 3'])
    
    // Test 1: Skip with multiple IDs should fail
    const multipleIdsResult = await tool.func({ 
      action: 'skip', 
      ids: [1, 2] 
    })
    const multipleIdsParsed = JSON.parse(multipleIdsResult)
    expect(multipleIdsParsed.ok).toBe(false)
    expect(multipleIdsParsed.output).toContain('skip action requires exactly one ID')
    
    // Test 2: Skip with single ID in array should work
    const singleIdArrayResult = await tool.func({ 
      action: 'skip', 
      ids: [2] 
    })
    const singleIdArrayParsed = JSON.parse(singleIdArrayResult)
    expect(singleIdArrayParsed.ok).toBe(true)
    expect(singleIdArrayParsed.output).toContain('Skipped TODO: 2')
    
    // Test 3: Skip without any ID should fail
    const noIdResult = await tool.func({ 
      action: 'skip' 
    })
    const noIdParsed = JSON.parse(noIdResult)
    expect(noIdParsed.ok).toBe(false)
    expect(noIdParsed.output).toContain('skip action requires exactly one ID')
    
    // Verify todos were actually skipped (task 2 was skipped, so task 1 and 3 remain)
    const remainingTodos = todoStore.getAll()
    expect(remainingTodos).toHaveLength(2)
    expect(remainingTodos[0].content).toBe('Task 1')
    expect(remainingTodos[0].id).toBe(1)  // Should remain as 1
    expect(remainingTodos[1].content).toBe('Task 3')
    expect(remainingTodos[1].id).toBe(2)  // Should be reindexed from 3 to 2
  })
})