import { describe, it, expect } from 'vitest'
import { formatTodoList } from './formatTodoList'
import { Todo } from '@/lib/runtime/TodoStore'

describe('formatTodoList', () => {
  it('tests that formatter creates clean markdown table', () => {
    const todos: Todo[] = [
      { id: 1, content: 'Navigate to website', status: 'done' },
      { id: 2, content: 'Find search box', status: 'doing' },
      { id: 3, content: 'Enter search query', status: 'todo' }
    ]
    
    const result = formatTodoList(todos)
    
    // Check structure
    expect(result).toContain('| # | Status | Task |')
    expect(result).toContain('|:-:|:------:|:-----|')
    
    // Check content
    expect(result).toContain('| 1 | | Navigate to website |')
    expect(result).toContain('| 2 | 🔄 | Find search box |')
    expect(result).toContain('| 3 | ⬜ | Enter search query |')
  })
  
  it('tests that empty list shows appropriate message', () => {
    const result = formatTodoList([])
    expect(result).toBe('*No tasks*')
  })
})