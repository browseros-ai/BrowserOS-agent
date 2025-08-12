import React, { useState, useMemo } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { ChevronDownIcon, ChevronUpIcon } from './ui/Icons'
import { z } from 'zod'

// Define the task schema with Zod
const TaskSchema = z.object({
  id: z.string(),  // Task ID
  status: z.string(),  // Task status (✅, 🔄, etc.)
  content: z.string()  // Task description
})

// Define the props schema with Zod
const TaskManagerDropdownPropsSchema = z.object({
  content: z.string(),  // Raw markdown table content
  className: z.string().optional()  // Optional CSS classes
})

// Infer types from schemas
type Task = z.infer<typeof TaskSchema>
type TaskManagerDropdownProps = z.infer<typeof TaskManagerDropdownPropsSchema>

// Small orange light component for completed tasks
const CompletionLight = ({ isCompleted }: { isCompleted: boolean }) => (
  <div className="flex-shrink-0">
    <div 
      className={cn(
        "w-2 h-2 rounded-full transition-colors duration-200",
        isCompleted 
          ? "bg-orange-500 shadow-sm" // Brand color equivalent
          : "bg-gray-300 dark:bg-gray-600"
      )}
    />
  </div>
)

export function TaskManagerDropdown({ content, className }: TaskManagerDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Parse tasks from markdown table content
  const tasks = useMemo(() => {
    const lines = content.split('\n')
    const taskLines = lines.filter(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine.startsWith('|')) return false
      
      const parts = trimmedLine.split('|').map(p => p.trim())
      // Skip header line (contains "Status" and "Task")
      if (parts.includes('Status') && parts.includes('Task')) return false
      // Skip separator line (contains only dashes and colons)
      if (parts.every(part => part === '' || part.includes(':-'))) return false
      
      return true
    })

    return taskLines.map(line => {
      const cells = line.split('|').filter(cell => cell.trim())
      if (cells.length >= 3) {
        return {
          id: cells[0].trim(),
          status: cells[1].trim(),
          content: cells[2].trim()
        }
      }
      return null
    }).filter(Boolean) as Task[]
  }, [content])

  // Count completed tasks
  const completedCount = useMemo(() => {
    return tasks.filter(task => task.status.includes('✅')).length
  }, [tasks])

  // Check if task is completed
  const isTaskCompleted = (task: Task) => task.status.includes('✅')

  // Show only first 6 tasks when expanded
  const MAX_VISIBLE_TASKS = 6
  const visibleTasks = tasks.slice(0, MAX_VISIBLE_TASKS)
  const hasMoreTasks = tasks.length > MAX_VISIBLE_TASKS

  if (tasks.length === 0) {
    return (
      <div className={cn("my-1", className)}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">Task Manager</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">No tasks available</div>
      </div>
    )
  }

  return (
    <div className={cn("my-1", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">Task Manager</span>
        </div>
        
        {/* Expand/Collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-4"
          aria-label={isExpanded ? 'Collapse task list' : 'Expand task list'}
        >
          <span>{completedCount}/{tasks.length} completed</span>
          {isExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded Task List */}
      {isExpanded && (
        <div className="space-y-1 max-h-48 overflow-y-auto pt-2">
          {visibleTasks.map((task, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 py-1 text-xs"
            >
              <CompletionLight isCompleted={isTaskCompleted(task)} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-foreground">
                  {task.content}
                </div>
              </div>
            </div>
          ))}
          

        </div>
      )}

    </div>
  )
} 