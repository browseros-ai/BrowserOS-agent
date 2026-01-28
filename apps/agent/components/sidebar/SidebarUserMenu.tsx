import { ChevronDown, LogIn, LogOut, User } from 'lucide-react'
import type { FC } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
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

interface SidebarUserMenuProps {
  expanded?: boolean
}

export const SidebarUserMenu: FC<SidebarUserMenuProps> = ({
  expanded = true,
}) => {
  const { sessionInfo } = useSessionInfo()
  const navigate = useNavigate()

  const user = sessionInfo?.user
  const isLoggedIn = !!user

  const handleLogin = () => {
    navigate('/login')
  }

  const handleLogout = () => {
    navigate('/logout')
  }

  const handleUpdateProfile = () => {
    navigate('/home/personalize')
  }

  const getInitials = (name?: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (!isLoggedIn) {
    return (
      <Button
        variant="ghost"
        size={expanded ? 'sm' : 'icon'}
        onClick={handleLogin}
        className={cn(
          'w-full justify-start gap-2',
          !expanded && 'h-9 w-9 justify-center p-0',
        )}
      >
        <LogIn className="size-4 shrink-0" />
        {expanded && <span>Sign in</span>}
      </Button>
    )
  }

  const userAvatar = user.image ? (
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

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-md transition-colors hover:bg-sidebar-accent',
            expanded ? 'w-full p-2' : 'h-9 w-9 justify-center',
          )}
        >
          {userAvatar}
          {expanded && (
            <>
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span className="truncate font-medium text-sm">
                  {user.name}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {user.email}
                </span>
              </div>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={expanded ? 'top' : 'right'}
        align={expanded ? 'start' : 'center'}
        className="w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="font-medium text-sm leading-none">{user.name}</p>
            <p className="text-muted-foreground text-xs leading-none">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleUpdateProfile}>
          <User className="mr-2 size-4" />
          Update Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} variant="destructive">
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
