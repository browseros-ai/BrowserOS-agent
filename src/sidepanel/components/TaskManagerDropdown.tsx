import React, { memo, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { z } from 'zod'
import { X, ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react'

// Task schema for runtime validation
const TaskSchema = z.object({
  id: z.string(),  // Unique identifier for each task
  status: z.string(),  // Task completion status
  content: z.string(),  // Task description
  order: z.number().optional(),  // Order for drag & drop
  isEditable: z.boolean().default(true)  // Whether task can be edited
})

type Task = z.infer<typeof TaskSchema>

interface TaskManagerDropdownProps {
  content: string  // Markdown content with task list
  className?: string  // Additional CSS classes
  isEditable?: boolean  // Whether the plan can be edited
  onTasksChange?: (tasks: Task[]) => void  // Callback when tasks are modified
  onExecute?: (tasks: Task[]) => void  // Callback when plan is executed
  onCancel?: () => void  // Callback when plan is cancelled
}

export function TaskManagerDropdown({ content, className, isEditable = false, onTasksChange, onExecute, onCancel }: TaskManagerDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(isEditable)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [localTasks, setLocalTasks] = useState<Task[]>([])
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [hasBeenExecuted, setHasBeenExecuted] = useState(false)  // Track if plan has been executed
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTaskId])

  // Parse markdown content into task objects
  const tasks = useMemo(() => {
    const lines = content.split('\n')
    
    const parsedTasks = lines
      .map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith('- [ ]') && !trimmed.startsWith('- [x]')) return null
        
        const isCompleted = trimmed.startsWith('- [x]')
        const taskContent = trimmed.replace(/^- \[[x ]\] /, '')
        
        return {
          id: `task-${index}`,
          status: isCompleted ? '✓' : '○',
          content: taskContent,
          order: index,
          isEditable: true
        }
      })
      .filter(Boolean) as Task[]

    if (isEditable && parsedTasks.length > 0) {
      setLocalTasks(parsedTasks)
    }

    return parsedTasks
  }, [content, isEditable])

  // Determine if editing is actually allowed (both prop and execution state)
  const isActuallyEditable = isEditable && !hasBeenExecuted

  // Always use local tasks if they exist (preserves edits after execution)
  const displayTasks = localTasks.length > 0 ? localTasks : tasks

  const completedCount = useMemo(() => {
    return displayTasks.filter(task => task.status === '✓').length
  }, [displayTasks])


  const startEdit = useCallback((task: Task) => {
    if (!isActuallyEditable) return
    setEditingTaskId(task.id)
    setEditText(task.content)
  }, [isActuallyEditable])

  const saveEdit = useCallback(() => {
    if (editingTaskId && editText.trim()) {
      const updatedTasks = localTasks.map(task => 
        task.id === editingTaskId ? { ...task, content: editText.trim() } : task
      )
      setLocalTasks(updatedTasks)
      onTasksChange?.(updatedTasks)
    } else if (editingTaskId) {
      // Delete task if content is empty
      const updatedTasks = localTasks.filter(task => task.id !== editingTaskId)
      setLocalTasks(updatedTasks)
      onTasksChange?.(updatedTasks)
    }
    setEditingTaskId(null)
    setEditText('')
  }, [editingTaskId, editText, localTasks, onTasksChange])

  const cancelEdit = useCallback(() => {
    setEditingTaskId(null)
    setEditText('')
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }, [saveEdit, cancelEdit])

  // Add new task at the end of the list
  const addTask = useCallback(() => {
    if (!isActuallyEditable) return
    const newTask = {
      id: `task-${Date.now()}`,
      status: '○',
      content: '',
      order: localTasks.length,
      isEditable: true
    }
    const updatedTasks = [...localTasks, newTask]
    setLocalTasks(updatedTasks)
    onTasksChange?.(updatedTasks)
    setTimeout(() => startEdit(newTask), 50)
  }, [localTasks, onTasksChange, startEdit, isActuallyEditable])

  const deleteTask = useCallback((taskId: string) => {
    if (!isActuallyEditable) return
    const updatedTasks = localTasks.filter(task => task.id !== taskId)
    setLocalTasks(updatedTasks)
    onTasksChange?.(updatedTasks)
  }, [localTasks, onTasksChange, isActuallyEditable])

  // Handle execution - disable editing permanently
  const handleExecute = useCallback(() => {
    setHasBeenExecuted(true)  // Mark as executed to disable editing
    setEditingTaskId(null)  // Cancel any ongoing edits
    onExecute?.(localTasks)
  }, [localTasks, onExecute])

  // Handle drag start for reordering tasks
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    if (!draggedTaskId || draggedTaskId === targetTaskId) return

    const draggedIndex = localTasks.findIndex(t => t.id === draggedTaskId)
    const targetIndex = localTasks.findIndex(t => t.id === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newTasks = [...localTasks]
    const [draggedTask] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(targetIndex, 0, draggedTask)

    const reorderedTasks = newTasks.map((task, index) => ({ ...task, order: index }))
    setLocalTasks(reorderedTasks)
    setDraggedTaskId(null)
    onTasksChange?.(reorderedTasks)
  }, [draggedTaskId, localTasks, onTasksChange])

  const isTaskCompleted = (task: Task) => task.status === '✓'
  const MAX_VISIBLE_TASKS = isActuallyEditable ? 20 : 6
  const visibleTasks = displayTasks.slice(0, MAX_VISIBLE_TASKS)
  const hasMoreTasks = displayTasks.length > MAX_VISIBLE_TASKS

  if (displayTasks.length === 0 && !isActuallyEditable) {
    return null
  }

  return (
    <div className={cn("my-1", className)}>

      {/* Task List */}
      {isExpanded && (
        <div className="space-y-0.5">
          {visibleTasks.map((task, index) => (
            <div key={task.id} className="group/step">
              <div
                className={cn(
                  "flex items-center gap-2 py-1.5 px-1 text-xs",
                  isActuallyEditable && "hover:bg-muted/20",
                  draggedTaskId === task.id && "opacity-50"
                )}
                draggable={isActuallyEditable && editingTaskId !== task.id}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, task.id)}
              >
                {/* Step number */}
                <span className="text-muted-foreground font-medium min-w-[50px]">
                  Step {index + 1}
                </span>
                
                {/* Task content */}
                <div className="flex-1 min-w-0">
                  {editingTaskId === task.id ? (
                    <input
                      ref={editInputRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEdit}
                      className="w-full px-1 py-0.5 text-xs bg-transparent border-b border-border focus:outline-none focus:border-brand"
                      placeholder="Enter step description..."
                    />
                  ) : (
                    <div
                      className={cn(
                        "truncate text-foreground",
                        isActuallyEditable && "cursor-pointer"
                      )}
                      onClick={isActuallyEditable ? () => startEdit(task) : undefined}
                      title={task.content}
                    >
                      {task.content}
                    </div>
                  )}
                </div>

                {/* Delete button */}
                {isActuallyEditable && editingTaskId !== task.id && (
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover/step:opacity-100 p-0.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded transition-all"
                    title="Delete step"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* Add step line below each step on hover */}
              {isActuallyEditable && (
                <div className="group/add-line relative opacity-0 group-hover/step:opacity-100 transition-opacity">
                  <div className="h-px bg-border mx-4" />
                  <button
                    onClick={() => {
                      const newTask: Task = {
                        id: `task-${Date.now()}`,
                        status: '○',
                        content: '',  // Start with empty content
                        order: index + 1,
                        isEditable: true
                      }
                      const updatedTasks = [...localTasks]
                      updatedTasks.splice(index + 1, 0, newTask)
                      
                      // Reorder remaining tasks
                      const reorderedTasks = updatedTasks.map((t, i) => ({ ...t, order: i }))
                      setLocalTasks(reorderedTasks)
                      onTasksChange?.(reorderedTasks)
                      
                      // Start editing the new task after a brief delay
                      setTimeout(() => startEdit(newTask), 50)
                    }}
                    className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-6 h-4 bg-brand text-white text-xs rounded hover:bg-brand/90 flex items-center justify-center transition-colors"
                    title="Add step below"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          ))}

          {hasMoreTasks && (
            <div className="text-xs text-muted-foreground pl-1 py-1">
              ... and {displayTasks.length - MAX_VISIBLE_TASKS} more steps
            </div>
          )}

          {/* Add first step when no steps exist */}
          {isActuallyEditable && visibleTasks.length === 0 && (
            <div className="group/empty relative py-2">
              <div className="h-px bg-border mx-4" />
              <button
                onClick={addTask}
                className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-6 h-4 bg-brand text-white text-xs rounded hover:bg-brand/90 flex items-center justify-center transition-colors"
                title="Add first step"
              >
                +
              </button>
            </div>
          )}
        </div>
      )}


      {/* Action buttons */}
      {isActuallyEditable && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleExecute}
            className="px-3 py-1 bg-brand text-white text-xs rounded hover:bg-brand/90 transition-colors"
          >
            Run Agent
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

    </div>
  )
}