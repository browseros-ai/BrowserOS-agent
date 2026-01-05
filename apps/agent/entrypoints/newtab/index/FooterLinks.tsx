import { Calendar, UserPen } from 'lucide-react'
import type { FC } from 'react'
import { NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'

interface FooterLinksProps {
  onOpenShortcuts: () => void
}

export const FooterLinks: FC<FooterLinksProps> = ({ onOpenShortcuts }) => {
  const { supports } = useCapabilities()

  return (
    <div className="flex items-center justify-center gap-4 pt-4">
      <a
        href="/options.html#/scheduled"
        className="group inline-flex flex-row gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        <Calendar className="h-4 w-4 transition-colors group-hover:text-accent-orange" />
        Scheduler
      </a>
      <span className="text-muted-foreground">•</span>

      {supports(Feature.PERSONALIZATION_SUPPORT) && (
        <>
          <NavLink
            to="/personalize"
            className="group inline-flex flex-row gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
          >
            <UserPen className="h-4 w-4 transition-colors group-hover:text-accent-orange" />
            Personalize{' '}
            <span className="text-accent-orange group-hover:text-accent-orange-bright">
              (new)
            </span>
          </NavLink>
          <span className="text-muted-foreground">•</span>
        </>
      )}

      {supports(Feature.MANAGED_MCP_SUPPORT) && (
        <>
          <a
            href="/options.html#/connect-mcp"
            className="text-muted-foreground text-xs transition-colors hover:text-foreground"
          >
            Connect MCP servers{' '}
          </a>
          <span className="text-muted-foreground">•</span>
        </>
      )}
      <a
        href="/options.html"
        className="text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        Settings
      </a>

      <span className="text-muted-foreground">•</span>
      <Button
        variant="link"
        onClick={onOpenShortcuts}
        className="hover:no-underline! px-0! text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        Shortcuts
      </Button>
    </div>
  )
}
