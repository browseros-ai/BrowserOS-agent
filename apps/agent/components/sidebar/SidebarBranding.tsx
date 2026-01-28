import { LogIn, LogOut, User } from 'lucide-react'
import type { FC } from 'react'
import { useNavigate } from 'react-router'
import ProductLogo from '@/assets/product_logo.svg'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSessionInfo } from '@/lib/auth/sessionStorage'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/use-workspace'

interface SidebarBrandingProps {
  expanded?: boolean
}

export const SidebarBranding: FC<SidebarBrandingProps> = ({
  expanded = true,
}) => {
  const { selectedFolder } = useWorkspace()
  const { sessionInfo } = useSessionInfo()
  const navigate = useNavigate()

  const user = sessionInfo?.user
  const isLoggedIn = !!user

  const getInitials = (name?: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const headerIcon = isLoggedIn ? (
    user.image ? (
      <img
        src={user.image}
        alt={user.name || 'User'}
        className="size-8 shrink-0 rounded-full object-cover"
      />
    ) : (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
        {getInitials(user.name)}
      </div>
    )
  ) : (
    <img src={ProductLogo} alt="BrowserOS" className="size-8" />
  )

  const headerContent = (
    <div className="flex h-14 items-center">
      <div className="flex w-14 shrink-0 items-center justify-center">
        {headerIcon}
      </div>
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between pr-3 transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex min-w-0 flex-col gap-0.5 leading-none">
          <span className="truncate font-semibold">
            {isLoggedIn ? user.name : selectedFolder?.name || 'BrowserOS'}
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {isLoggedIn ? user.email : 'Personal'}
          </span>
        </div>
        <ThemeToggle className="h-8 w-8 shrink-0" iconClassName="h-4 w-4" />
      </div>
    </div>
  )

  return (
    <div className="border-b">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="w-full text-left transition-colors hover:bg-sidebar-accent"
          >
            {headerContent}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={expanded ? 'bottom' : 'right'}
          align="start"
          className="w-56"
        >
          {isLoggedIn ? (
            <>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="font-medium text-sm leading-none">
                    {user.name}
                  </p>
                  <p className="text-muted-foreground text-xs leading-none">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/home/personalize')}>
                <User className="mr-2 size-4" />
                Update Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate('/logout')}
                variant="destructive"
              >
                <LogOut className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => navigate('/login')}>
              <LogIn className="mr-2 size-4" />
              Sign in
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
