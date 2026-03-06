import { Info, Keyboard, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getWhatsNewPath } from '@/lib/whats-new/whats-new-config'

interface SidebarUserFooterProps {
  expanded?: boolean
  onOpenShortcuts?: () => void
}

export const SidebarUserFooter: FC<SidebarUserFooterProps> = ({
  expanded = true,
  onOpenShortcuts,
}) => {
  // const signInButton = (
  //   <Button
  //     variant="outline"
  //     className="h-9 w-full justify-start gap-2 overflow-hidden whitespace-nowrap px-3"
  //     disabled
  //   >
  //     <LogIn className="size-4 shrink-0" />
  //     <span
  //       className={cn(
  //         'truncate transition-opacity duration-200',
  //         expanded ? 'opacity-100' : 'opacity-0',
  //       )}
  //     >
  //       Sign in to BrowserOS
  //     </span>
  //   </Button>
  // )

  const aboutLink = (
    <a
      href="https://docs.browseros.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Info className="size-4 shrink-0" />
      <span
        className={cn(
          'truncate transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        About BrowserOS
      </span>
    </a>
  )

  const whatsNewLink = (
    <NavLink
      to={getWhatsNewPath({ source: 'sidebar-footer' })}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )
      }
    >
      <Sparkles className="size-4 shrink-0" />
      <span
        className={cn(
          'truncate transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        What's New
      </span>
    </NavLink>
  )

  const shortcutsButton = (
    <Button
      variant="ghost"
      onClick={onOpenShortcuts}
      className="flex h-9 w-full items-center justify-start gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Keyboard className="size-4 shrink-0" />
      <span
        className={cn(
          'truncate transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        Shortcuts
      </span>
    </Button>
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div className="mt-auto space-y-1 border-t p-2">
        {expanded ? (
          shortcutsButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{shortcutsButton}</TooltipTrigger>
            <TooltipContent side="right">Shortcuts</TooltipContent>
          </Tooltip>
        )}

        {expanded ? (
          whatsNewLink
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{whatsNewLink}</TooltipTrigger>
            <TooltipContent side="right">What's New</TooltipContent>
          </Tooltip>
        )}

        {expanded ? (
          aboutLink
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{aboutLink}</TooltipTrigger>
            <TooltipContent side="right">About BrowserOS</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
