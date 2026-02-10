import {
  BookOpen,
  ExternalLink,
  Headphones,
  Mail,
  MessageCircle,
  Newspaper,
  Rocket,
  Search,
  Sparkles,
} from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  SUPPORT_CHAT_OPENED_EVENT,
  SUPPORT_PAGE_VIEWED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { env } from '@/lib/env'
import { useIntercomSafe } from '@/lib/intercom/IntercomProvider'
import { track } from '@/lib/metrics/track'
import { cn } from '@/lib/utils'

const helpTopics = [
  {
    icon: Rocket,
    title: 'Getting Started',
    description: 'Learn the basics of BrowserOS and set up your workspace.',
  },
  {
    icon: Sparkles,
    title: 'AI Agent',
    description: 'Using the AI assistant to automate your browsing tasks.',
  },
  {
    icon: BookOpen,
    title: 'Workflows',
    description: 'Create and manage automated browser workflows.',
  },
  {
    icon: Newspaper,
    title: 'Scheduled Tasks',
    description: 'Set up recurring tasks that run on a schedule.',
  },
]

export const SupportPage: FC = () => {
  const intercom = useIntercomSafe()
  const [searchQuery, setSearchQuery] = useState('')

  const hasIntercom = !!env.VITE_PUBLIC_INTERCOM_APP_ID

  useEffect(() => {
    track(SUPPORT_PAGE_VIEWED_EVENT)
  }, [])

  const handleOpenChat = () => {
    track(SUPPORT_CHAT_OPENED_EVENT)
    intercom?.show()
  }

  const handleShowMessages = () => {
    intercom?.showMessages()
  }

  const handleShowNewMessage = (content?: string) => {
    track(SUPPORT_CHAT_OPENED_EVENT)
    intercom?.showNewMessage(content || '')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      handleShowNewMessage(searchQuery.trim())
      setSearchQuery('')
    }
  }

  const handleTopicClick = (title: string) => {
    handleShowNewMessage(`I need help with: ${title}`)
  }

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
            <Headphones className="h-6 w-6 text-[var(--accent-orange)]" />
          </div>
          <div className="flex-1">
            <h2 className="mb-1 font-semibold text-xl">Support</h2>
            <p className="text-muted-foreground text-sm">
              Get help from our team or browse support resources
            </p>
          </div>
        </div>
      </div>

      {/* Chat CTA */}
      <Card className="overflow-hidden border-border">
        <div className="relative p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/5 via-transparent to-transparent" />
          <div className="relative flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/10 ring-1 ring-[var(--accent-orange)]/20">
              <MessageCircle className="h-8 w-8 text-[var(--accent-orange)]" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Chat with our team</h3>
              <p className="mx-auto max-w-md text-muted-foreground text-sm">
                Have a question or need help? Start a conversation with our
                support team and we'll get back to you as soon as possible.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleOpenChat}
                disabled={!hasIntercom}
                className="gap-2 bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange-bright)]"
              >
                <MessageCircle className="h-4 w-4" />
                Start a conversation
              </Button>
              {hasIntercom && (
                <Button
                  variant="outline"
                  onClick={handleShowMessages}
                  className="gap-2"
                >
                  View messages
                </Button>
              )}
            </div>
            {!hasIntercom && (
              <p className="text-muted-foreground text-xs">
                Intercom is not configured. Set{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  VITE_PUBLIC_INTERCOM_APP_ID
                </code>{' '}
                in your environment to enable live chat.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} aria-label="Support search">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Describe what you need help with..."
            aria-label="Describe what you need help with"
            disabled={!hasIntercom}
            className="pr-4 pl-10"
          />
        </div>
      </form>

      {/* Help Topics */}
      <div className="space-y-3">
        <h3 className="font-medium text-muted-foreground text-sm">
          Popular topics
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {helpTopics.map((topic) => {
            const Icon = topic.icon
            return (
              <button
                key={topic.title}
                type="button"
                onClick={() => handleTopicClick(topic.title)}
                disabled={!hasIntercom}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all',
                  hasIntercom &&
                    'cursor-pointer hover:border-[var(--accent-orange)]/30 hover:shadow-sm',
                  !hasIntercom && 'opacity-60',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{topic.title}</p>
                  <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                    {topic.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Resources */}
      <div className="space-y-3">
        <h3 className="font-medium text-muted-foreground text-sm">Resources</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://docs.browseros.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-all hover:border-[var(--accent-orange)]/30 hover:shadow-sm"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Documentation
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
          <a
            href="mailto:support@browseros.com"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-all hover:border-[var(--accent-orange)]/30 hover:shadow-sm"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email support
          </a>
        </div>
      </div>
    </div>
  )
}
