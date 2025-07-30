import { describe, it, expect, vi } from 'vitest'
import { TodoStore } from './TodoStore'

describe('TodoStore-unit-test', () => {
  // Test 1: Creation and basic operations
  it('tests that todos can be added and retrieved', () => {
    const store = new TodoStore()
    
    // Add multiple todos
    store.addMultiple(['Task 1', 'Task 2', 'Task 3'])
    
    // Verify todos were added
    const todos = store.getAll()
    expect(todos).toHaveLength(3)
    expect(todos[0].id).toBe(1)
    expect(todos[0].content).toBe('Task 1')
    expect(todos[0].status).toBe('todo')
    expect(todos[2].id).toBe(3)
    expect(todos[2].content).toBe('Task 3')
  })

  // Test 2: Doing status management
  it('tests that only one todo can be marked as doing at a time', () => {
    const store = new TodoStore()
    store.addMultiple(['Task 1', 'Task 2', 'Task 3'])
    
    // Mark first todo as doing
    store.markDoing(1)
    const todos1 = store.getAll()
    expect(todos1.find(t => t.id === 1)?.status).toBe('doing')
    
    // Try to mark another todo as doing - should throw
    expect(() => store.markDoing(2)).toThrow('Cannot mark TODO 2 as doing - TODO 1 is already in progress')
    
    // Complete the first todo
    store.completeMultiple([1])
    
    // Now we can mark another todo as doing
    store.markDoing(2)
    const todos2 = store.getAll()
    expect(todos2.find(t => t.id === 2)?.status).toBe('doing')
    expect(todos2.find(t => t.id === 1)?.status).toBe('done')
  })

  // Test 3: Skip and reindex functionality
  it('tests that skip removes todo and reindexes remaining todos', () => {
    const store = new TodoStore()
    store.addMultiple(['Task 1', 'Task 2', 'Task 3', 'Task 4'])
    
    // Verify initial state
    expect(store.getAll()).toHaveLength(4)
    expect(store.getAll()[1].id).toBe(2)
    expect(store.getAll()[1].content).toBe('Task 2')
    
    // Skip todo with id 2
    store.skip(2)
    
    // Verify todo was removed
    const todos = store.getAll()
    expect(todos).toHaveLength(3)
    
    // Verify reindexing - all IDs should be sequential
    expect(todos[0].id).toBe(1)
    expect(todos[0].content).toBe('Task 1')
    expect(todos[1].id).toBe(2)
    expect(todos[1].content).toBe('Task 3')  // Was previously id 3
    expect(todos[2].id).toBe(3)
    expect(todos[2].content).toBe('Task 4')  // Was previously id 4
    
    // Skip another one to verify reindexing works consistently
    store.skip(1)
    const todosAfterSecondSkip = store.getAll()
    expect(todosAfterSecondSkip).toHaveLength(2)
    expect(todosAfterSecondSkip[0].id).toBe(1)
    expect(todosAfterSecondSkip[0].content).toBe('Task 3')
    expect(todosAfterSecondSkip[1].id).toBe(2)
    expect(todosAfterSecondSkip[1].content).toBe('Task 4')
  })
})

describe('TodoStore-integration-test', () => {
  // Integration test - testing real workflow
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'tests the complete todo workflow with multiple operations',
    async () => {
      const store = new TodoStore()
      
      // Add initial todos
      store.addMultiple(['Navigate to website', 'Click login button', 'Fill form', 'Submit'])
      
      // Get next todo (should mark first as doing)
      const firstTodo = store.getNextTodo()
      expect(firstTodo).toBeDefined()
      expect(firstTodo?.status).toBe('doing')
      
      // Complete it
      store.completeMultiple([firstTodo!.id])
      
      // Get next todo
      const secondTodo = store.getNextTodo()
      expect(secondTodo?.content).toBe('Click login button')
      expect(secondTodo?.status).toBe('doing')
      
      // Skip it
      store.skip(secondTodo!.id)
      
      // Verify state after operations
      const todos = store.getAll()
      expect(todos).toHaveLength(3)
      expect(todos.find(t => t.content === 'Navigate to website')?.status).toBe('done')
      expect(todos.find(t => t.content === 'Click login button')).toBeUndefined()
      
      console.log('✅ Integration test passed')
    },
    30000
  )
})