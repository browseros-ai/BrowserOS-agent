import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'
import {
  CheckCircle,
  Download,
  GitBranch,
  GitMerge,
  MousePointer,
  Navigation,
  Play,
  RotateCw,
  Split,
  Square,
} from 'lucide-react'
import type React from 'react'
import { memo } from 'react'
import { cn } from '@/lib/utils'

const nodeConfig: Record<
  NodeType,
  { color: string; icon: React.ElementType; label: string }
> = {
  start: {
    color: 'text-green-600 dark:text-green-400',
    icon: Play,
    label: 'Start',
  },
  end: {
    color: 'text-red-600 dark:text-red-400',
    icon: Square,
    label: 'End',
  },
  nav: {
    color: 'text-blue-600 dark:text-blue-400',
    icon: Navigation,
    label: 'Navigate',
  },
  act: {
    color: 'text-purple-600 dark:text-purple-400',
    icon: MousePointer,
    label: 'Action',
  },
  extract: {
    color: 'text-amber-600 dark:text-amber-400',
    icon: Download,
    label: 'Extract',
  },
  verify: {
    color: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle,
    label: 'Verify',
  },
  decision: {
    color: 'text-pink-600 dark:text-pink-400',
    icon: GitBranch,
    label: 'Decision',
  },
  loop: {
    color: 'text-cyan-600 dark:text-cyan-400',
    icon: RotateCw,
    label: 'Loop',
  },
  fork: {
    color: 'text-indigo-600 dark:text-indigo-400',
    icon: Split,
    label: 'Fork',
  },
  join: {
    color: 'text-lime-600 dark:text-lime-400',
    icon: GitMerge,
    label: 'Join',
  },
}

export type NodeType =
  | 'start'
  | 'end'
  | 'nav'
  | 'act'
  | 'extract'
  | 'verify'
  | 'decision'
  | 'loop'
  | 'fork'
  | 'join'

type CustomNodeData = Node<{
  type: NodeType
  label: string
}>

export const CustomNode = memo(
  ({ data: { label, type } }: NodeProps<CustomNodeData>) => {
    const config = nodeConfig[type || 'start']
    const Icon = config.icon

    const showSourceHandle = type !== 'end'
    const showTargetHandle = type !== 'start'

    return (
      <div className="min-w-45 rounded-lg border border-border bg-card px-4 py-3 shadow-md transition-all">
        {showTargetHandle && (
          <Handle
            type="target"
            position={Position.Top}
            className="h-2 w-2 bg-accent-orange!"
          />
        )}

        <div className="flex items-center gap-2">
          <div className={cn('shrink-0', config.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'mb-0.5 font-semibold text-xs uppercase tracking-wide',
                config.color,
              )}
            >
              {config.label}
            </div>
            <div className="wrap-break-word font-medium text-foreground text-sm">
              {label}
            </div>
          </div>
        </div>

        {showSourceHandle && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="h-2 w-2 bg-accent-orange!"
          />
        )}
      </div>
    )
  },
)

CustomNode.displayName = 'CustomNode'
