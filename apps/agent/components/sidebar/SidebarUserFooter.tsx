import { Info, LogIn } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarUserFooterProps {
  expanded?: boolean
}

const linkClasses =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

export const SidebarUserFooter: FC<SidebarUserFooterProps> = ({
  expanded = true,
}) => {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="mt-auto space-y-1 border-t p-2">
        {expanded ? (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled
          >
            <LogIn className="size-4 shrink-0" />
            <span className="truncate">Sign in to BrowserOS</span>
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="w-full" disabled>
                <LogIn className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign in to BrowserOS</TooltipContent>
          </Tooltip>
        )}

        {expanded ? (
          <a
            href="https://docs.browseros.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
          >
            <Info className="size-4 shrink-0" />
            <span className="truncate">About BrowserOS</span>
          </a>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://docs.browseros.com/"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(linkClasses, 'justify-center px-2')}
              >
                <Info className="size-4 shrink-0" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="right">About BrowserOS</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
