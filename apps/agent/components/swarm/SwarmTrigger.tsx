/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmTrigger - Button to enable swarm mode in chat
 */
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Zap } from 'lucide-react'
import { useState } from 'react'

interface SwarmTriggerProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onConfigChange?: (config: SwarmConfig) => void
  config?: SwarmConfig
  className?: string
}

export interface SwarmConfig {
  maxWorkers: number
  priority: 'critical' | 'high' | 'normal' | 'low' | 'background'
}

const defaultConfig: SwarmConfig = {
  maxWorkers: 5,
  priority: 'normal',
}

/**
 * @public
 */
export const SwarmTrigger: FC<SwarmTriggerProps> = ({
  enabled,
  onToggle,
  onConfigChange,
  config = defaultConfig,
  className,
}) => {
  const [localConfig, setLocalConfig] = useState(config)

  const handleConfigChange = (updates: Partial<SwarmConfig>) => {
    const newConfig = { ...localConfig, ...updates }
    setLocalConfig(newConfig)
    onConfigChange?.(newConfig)
  }

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={enabled ? 'default' : 'ghost'}
                size="icon"
                className={cn(
                  'h-8 w-8 transition-all',
                  enabled && 'bg-purple-500 hover:bg-purple-600 text-white',
                  className,
                )}
                onClick={() => !enabled && onToggle(true)}
              >
                <Zap
                  className={cn(
                    'h-4 w-4',
                    enabled && 'animate-pulse',
                  )}
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{enabled ? 'Swarm Mode Active' : 'Enable Swarm Mode'}</p>
            <p className="text-xs text-muted-foreground">
              Parallelize tasks across multiple browser windows
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Swarm Mode</h4>
              <Button
                variant={enabled ? 'destructive' : 'default'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => onToggle(!enabled)}
              >
                {enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Spawn multiple workers to tackle complex tasks in parallel
            </p>
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="maxWorkers" className="text-xs">
                  Max Workers
                </Label>
                <Input
                  id="maxWorkers"
                  type="number"
                  min={2}
                  max={10}
                  value={localConfig.maxWorkers}
                  onChange={(e) =>
                    handleConfigChange({
                      maxWorkers: Math.min(10, Math.max(2, parseInt(e.target.value) || 5)),
                    })
                  }
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground">
                  Number of parallel browser windows (2-10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="text-xs">
                  Priority
                </Label>
                <Select
                  value={localConfig.priority}
                  onValueChange={(value) =>
                    handleConfigChange({ priority: value as SwarmConfig['priority'] })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="background">Background</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
