import { z } from 'zod'

// Schema for individual TODO
export const TodoSchema = z.object({
  id: z.number().int().positive(),  // 1-based sequential ID
  content: z.string(),  // What needs to be done
  status: z.enum(['todo', 'doing', 'done', 'skipped'])  // Current status
})

export type Todo = z.infer<typeof TodoSchema>

/**
 * TodoStore manages a list of TODOs for complex task execution
 */
export class TodoStore {
  private todos: Todo[] = []
  private static readonly MAX_TODOS = 30  // Cap at 30 TODOs

  /**
   * Get all TODOs
   */
  getAll(): Todo[] {
    return [...this.todos]
  }

  /**
   * Add multiple TODOs at once
   */
  addMultiple(contents: string[]): void {
    const startId = this.todos.length + 1
    const newTodos = contents.map((content, index) => ({
      id: startId + index,
      content,
      status: 'todo' as const
    }))
    
    this.todos.push(...newTodos)
    
    // Cap at MAX_TODOS
    if (this.todos.length > TodoStore.MAX_TODOS) {
      this.todos = this.todos.slice(0, TodoStore.MAX_TODOS)
    }
  }

  /**
   * Mark multiple TODOs as complete
   */
  completeMultiple(ids: number[]): void {
    ids.forEach(id => {
      const todo = this.todos.find(t => t.id === id)
      if (todo) {
        todo.status = 'done'
      }
    })
  }

  /**
   * Skip a single TODO (removes it and reindexes)
   */
  skip(id: number): void {
    this.todos = this.todos.filter(t => t.id !== id)
    this._reindex()
  }

  /**
   * Replace all TODOs with new ones
   */
  replaceAll(contents: string[]): void {
    this.todos = []
    this.addMultiple(contents)
  }

  /**
   * Mark a TODO as doing (only one allowed at a time)
   */
  markDoing(id: number): void {
    // Check if another TODO is already doing
    const currentDoing = this.todos.find(t => t.status === 'doing')
    if (currentDoing && currentDoing.id !== id) {
      throw new Error(`Cannot mark TODO ${id} as doing - TODO ${currentDoing.id} is already in progress`)
    }
    
    const todo = this.todos.find(t => t.id === id)
    if (todo) {
      todo.status = 'doing'
    }
  }

  /**
   * Get the next TODO to work on (returns current doing or next todo)
   */
  getNextTodo(): Todo | null {
    // First check if there's a current doing TODO
    const currentDoing = this.getCurrentDoing()
    if (currentDoing) {
      return currentDoing
    }
    
    // Otherwise find the first pending TODO
    const pending = this.getPending()
    if (pending.length === 0) {
      return null
    }
    
    // Mark it as doing and return
    const nextTodo = pending[0]
    this.markDoing(nextTodo.id)
    return nextTodo
  }

  /**
   * Get the currently active TODO
   */
  getCurrentDoing(): Todo | null {
    return this.todos.find(t => t.status === 'doing') || null
  }

  /**
   * Get all pending TODOs (status = 'todo')
   */
  getPending(): Todo[] {
    return this.todos.filter(t => t.status === 'todo')
  }

  /**
   * Check if all TODOs are either done or skipped
   */
  isAllDoneOrSkipped(): boolean {
    return this.todos.every(t => t.status === 'done' || t.status === 'skipped')
  }

  /**
   * Check if a specific TODO is completed
   */
  isCompleted(id: number): boolean {
    const todo = this.todos.find(t => t.id === id)
    return todo ? (todo.status === 'done' || todo.status === 'skipped') : false
  }

  /**
   * Get XML representation of TODOs
   */
  getXml(): string {
    if (this.todos.length === 0) {
      return '<todos></todos>'
    }
    
    const todoElements = this.todos.map(todo => 
      `<todo id="${todo.id}" status="${todo.status}">${this._escapeXml(todo.content)}</todo>`
    ).join('\n')
    
    return `<todos>\n${todoElements}\n</todos>`
  }

  /**
   * Get JSON representation of TODOs
   */
  getJson(): Todo[] {
    return [...this.todos]
  }

  /**
   * Reset all TODOs
   */
  reset(): void {
    this.todos = []
  }

  /**
   * Reindex TODOs to maintain sequential 1-based IDs
   */
  private _reindex(): void {
    this.todos.forEach((todo, index) => {
      todo.id = index + 1
    })
  }

  /**
   * Escape XML special characters
   */
  private _escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}