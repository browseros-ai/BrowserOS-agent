import { Plus, Server } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AddManagedMCPDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serversList?: { name: string; description: string }[]
  onAddServer: (args: { name: string; description: string }) => void
}

export const AddManagedMCPDialog: FC<AddManagedMCPDialogProps> = ({
  open,
  onOpenChange,
  serversList,
  onAddServer,
}) => {
  const handleAddServer = (args: { name: string; description: string }) => {
    onAddServer(args)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enable built-in MCP Server</DialogTitle>
          <DialogDescription>
            Select a built-in MCP server to enable
          </DialogDescription>
        </DialogHeader>

        <div className="styled-scrollbar max-h-[400px] w-full space-y-2 overflow-y-auto">
          {serversList?.map((args) => {
            const { name: serverName, description } = args
            return (
              <Button
                key={serverName}
                variant="outline"
                onClick={() => handleAddServer(args)}
                className="group h-auto w-full items-center gap-3 p-3 hover:border-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/5"
              >
                <Server className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex w-[calc(100%-64px)] flex-1 flex-col items-start gap-1">
                  <span className="font-medium">{serverName}</span>
                  {description && (
                    <p className="line-clamp-1 w-full text-ellipsis text-left text-muted-foreground text-xs">
                      {description}
                    </p>
                  )}
                </div>
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            )
          }) ?? null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
