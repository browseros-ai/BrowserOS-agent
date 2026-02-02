import { Server } from 'lucide-react'
import type { FC } from 'react'
import FigmaSvg from '@/assets/mcp-icons/figma.svg'
import GithubSvg from '@/assets/mcp-icons/github.svg'
import GitlabSvg from '@/assets/mcp-icons/gitlab.svg'
import GmailSvg from '@/assets/mcp-icons/gmail.svg'
import GoogleSvg from '@/assets/mcp-icons/google.svg'
import GoogleCalendarSvg from '@/assets/mcp-icons/google_calendar.svg'
import GoogleDocsSvg from '@/assets/mcp-icons/google_docs_editors.svg'
import GoogleDriveSvg from '@/assets/mcp-icons/google_drive.svg'
import LinearSvg from '@/assets/mcp-icons/linear.svg'
import LinkedinSvg from '@/assets/mcp-icons/linkedin.svg'
import NotionSvg from '@/assets/mcp-icons/notion.svg'
import SlackSvg from '@/assets/mcp-icons/slack.svg'

const mcpIconMap: Record<string, string> = {
  Gmail: GmailSvg,
  'Google Calendar': GoogleCalendarSvg,
  'Google Docs': GoogleDocsSvg,
  'Google Drive': GoogleDriveSvg,
  'Google Sheets': GoogleSvg,
  Slack: SlackSvg,
  LinkedIn: LinkedinSvg,
  Notion: NotionSvg,
  Airtable: GoogleSvg,
  GitHub: GithubSvg,
  GitLab: GitlabSvg,
  Linear: LinearSvg,
  Figma: FigmaSvg,
}

interface McpServerIconProps {
  serverName: string
  size?: number
  className?: string
}

export const McpServerIcon: FC<McpServerIconProps> = ({
  serverName,
  size = 20,
  className,
}) => {
  const iconSrc = mcpIconMap[serverName]

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={serverName}
        width={size}
        height={size}
        className={`rounded-md ${className ?? ''}`}
      />
    )
  }

  return <Server size={size} className={className} />
}
