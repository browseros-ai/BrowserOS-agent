import { Todo } from '@/lib/runtime/TodoStore'

/**
 * Format TODO list as markdown table
 */
export function formatTodoList(todos: Todo[]): string {
  if (todos.length === 0) {
    return '#### 📋 TODO List\n\n*No tasks*'
  }

  let markdown = '#### 📋 TODO List\n'
  markdown += '| # | Status | Task |\n'
  markdown += '|:-:|:------:|:-----|\n'
  
  todos.forEach(todo => {
    const icon = getStatusIcon(todo.status)
    markdown += `| ${todo.id} | ${icon} | ${todo.content} |\n`
  })
  
  return markdown
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'todo': return '⬜'
    case 'doing': return '🔄'
    case 'done': return '✅'
    case 'skipped': return '⏭️'
    default: return status
  }
}