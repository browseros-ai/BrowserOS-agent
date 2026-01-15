import { Check, ChevronDown, Folder, FolderOpen, X } from 'lucide-react'
import type { FC, PropsWithChildren } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/use-workspace'
import type { WorkspaceFolder } from '@/lib/workspace/workspace-storage'

interface WorkspaceSelectorProps {
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export const WorkspaceSelector: FC<
  PropsWithChildren<WorkspaceSelectorProps>
> = ({ children, side = 'top' }) => {
  const [open, setOpen] = useState(false)
  const {
    recentFolders,
    selectedFolder,
    selectFolder,
    addFolder,
    removeFolder,
    clearSelection,
  } = useWorkspace()

  const handleChooseFolder = async () => {
    try {
      // @ts-expect-error - showDirectoryPicker is not in all TypeScript lib definitions
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })

      const folder: WorkspaceFolder = {
        id: crypto.randomUUID(),
        name: handle.name,
        path: handle.name,
        addedAt: Date.now(),
      }

      await addFolder(folder)
      setOpen(false)
    } catch {
      // User cancelled or permission denied - silently ignore
    }
  }

  const handleSelectFolder = async (folder: WorkspaceFolder) => {
    if (selectedFolder?.id === folder.id) {
      await clearSelection()
    } else {
      await selectFolder(folder)
    }
    setOpen(false)
  }

  const handleRemoveFolder = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation()
    await removeFolder(folderId)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex items-center gap-1.5 text-muted-foreground hover:text-foreground',
              selectedFolder && 'text-foreground',
            )}
          >
            <Folder className="h-4 w-4" />
            <span>
              {selectedFolder ? selectedFolder.name : 'Work in a folder'}
            </span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align="start"
        className="w-80 p-0"
        role="dialog"
        aria-label="Select workspace folder"
      >
        {recentFolders.length > 0 && (
          <>
            <div className="px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Recent
            </div>
            <div className="max-h-64 overflow-y-auto">
              {recentFolders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => handleSelectFolder(folder)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelectFolder(folder)
                    }
                  }}
                  role="option"
                  aria-selected={selectedFolder?.id === folder.id}
                  tabIndex={0}
                  className={cn(
                    'group flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors hover:bg-muted',
                    selectedFolder?.id === folder.id && 'bg-muted',
                  )}
                >
                  <Folder className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">
                      {folder.name}
                    </div>
                    <div className="truncate text-muted-foreground text-xs">
                      {folder.path}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {selectedFolder?.id === folder.id && (
                      <Check className="h-4 w-4 text-[var(--accent-orange)]" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFolder(e, folder.id)}
                      className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-100"
                      aria-label={`Remove ${folder.name} from recents`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t" />
          </>
        )}

        <button
          type="button"
          onClick={handleChooseFolder}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
        >
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Choose a different folder</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
