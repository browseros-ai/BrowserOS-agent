import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  BookOpenText,
  ClipboardList,
  CodeXml,
  FileTerminal,
  Layers,
  LayoutDashboard,
  Link,
  LinkIcon,
  Lock,
  MessageSquare,
  Monitor,
  MousePointerClick,
  Puzzle,
  Search,
  Settings,
  ShieldCheck,
  SlidersVertical,
  SplitSquareHorizontal,
  SquareStack,
  Zap,
} from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import DiscordLogo from '@/assets/discord-logo.svg'
import GithubLogo from '@/assets/github-logo.svg'
import SlackLogo from '@/assets/slack-logo.svg'
import { PillIndicator } from '@/components/elements/pill-indicator'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  AGENT_MODE_DEMO_URL,
  BROWSER_OS_INTRO_VIDEO_URL,
  MCP_SERVER_DEMO_URL,
  QUICK_SEARCH_GIF_URL,
  SPLIT_VIEW_GIF_URL,
} from '@/lib/constants/mediaUrls'
import {
  discordUrl,
  docsUrl,
  productRepositoryUrl,
  slackUrl,
} from '@/lib/constants/productUrls'
import { cn } from '@/lib/utils'
import { BentoCard, type Feature } from './BentoCard'
import { VideoFrame } from './VideoFrame'

const features: Feature[] = [
  {
    id: 'split-view',
    Icon: SplitSquareHorizontal,
    tag: 'CORE',
    title: 'Split-View Mode',
    description: 'Use ChatGPT, Claude, and Gemini alongside any website.',
    highlights: [
      {
        title: 'Stop Tab Switching Chaos',
        description:
          'Access ChatGPT, Gemini, and Claude on any website without switching tabs. Use your own logins and API keys.',
        Icon: LayoutDashboard,
      },
      {
        title: 'Clash-of-GPTs',
        description:
          'Use multiple LLMs side-by-side. Compare responses from different AI providers simultaneously.',
        Icon: ShieldCheck,
      },
      {
        title: 'Toggle with Shortcut',
        description: (
          <>
            <KbdGroup>
              <Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>L</Kbd>
            </KbdGroup>{' '}
            on any webpage
          </>
        ),
        Icon: ArrowLeftRight,
      },
      {
        title: 'Switch Provider with Shortcut',
        description: (
          <>
            <KbdGroup>
              <Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>;</Kbd>
            </KbdGroup>{' '}
            to switch providers
          </>
        ),
        Icon: SlidersVertical,
      },
    ],
    tip: 'Use shortcuts to toggle split-view mode and switch providers.',
    gridClass: 'md:col-span-2',
    gifUrl: SPLIT_VIEW_GIF_URL,
  },
  {
    id: 'context-aware',
    tag: 'AI',
    Icon: MessageSquare,
    title: 'Built in Agent',
    description:
      'Let BrowserOS Agent browse, click, type, and complete tasks for you. Just describe what you need done!',
    highlights: [
      {
        title: 'Smart Navigation',
        description:
          'Agent navigates websites and finds information automatically',
        Icon: MousePointerClick,
      },
      {
        title: 'Form Filling',
        description:
          'Automatically fills forms with intelligent context understanding',
        Icon: ClipboardList,
      },
      {
        title: 'Data Extraction',
        description: 'Extracts and organizes data from any webpage',
        Icon: SquareStack,
      },
      {
        title: 'Privacy Protected',
        description: 'All automation runs locally with your own API keys',
        Icon: Lock,
      },
    ],
    videoDuration: '2:22',
    tip: 'Simply describe your task in natural language and let the agent handle the complexity!',
    gridClass: 'md:col-span-1',
    videoUrl: AGENT_MODE_DEMO_URL,
  },
  {
    id: 'workflow-presets',
    tag: 'PRODUCTIVITY',
    Icon: Layers,
    title: 'BrowserOS as MCP Server',
    description:
      'Connect BrowserOS with Claude Code, Claude Desktop, and other MCP clients for powerful agentic browser automation',
    highlights: [
      {
        title: 'Agentic Browser Automation',
        description: 'Execute web tasks autonomously through natural language',
        Icon: Monitor,
      },
      {
        title: 'Seamless Integration',
        description: 'Works with Claude Code, Desktop, and MCP clients',
        Icon: Link,
      },
      {
        title: 'Web Development Workflows',
        description: 'Accelerate frontend development and prototyping',
        Icon: CodeXml,
      },
      {
        title: 'Web Automation',
        description: 'Automate repetitive web tasks and workflows',
        Icon: FileTerminal,
      },
    ],
    videoDuration: '1:40',
    tip: 'Use commands like "Open amazon.com on browseros" to control your browser directly from Claude! Read the setup guide to get started.',
    gridClass: 'md:col-span-1',
    videoUrl: MCP_SERVER_DEMO_URL,
  },
  {
    id: 'search',
    tag: 'SEARCH',
    Icon: Search,
    title: 'Quick Search',
    description:
      'Lightning-fast search using any AI provider from the new tab page.',
    highlights: [
      {
        title: 'Instant AI Search',
        description:
          'Search with any AI provider directly from your new tab page',
        Icon: Search,
      },
      {
        title: 'Lightning Fast',
        description: 'Opens the search results within 400ms!',
        Icon: Zap,
      },
      {
        title: 'Easy Configuration',
        description: 'You can customize providers in settings.',
        Icon: Settings,
      },
      {
        title: 'Multiple Providers',
        description:
          'Switch between Google, ChatGPT, Claude, Gemini and more instantly',
        Icon: Puzzle,
      },
    ],
    tip: 'Set up your default AI provider in settings for the fastest search experience!',
    gridClass: 'md:col-span-2',
    gifUrl: QUICK_SEARCH_GIF_URL,
  },
]

/**
 * @public
 */
export const FeaturesPage: FC = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleStart = async () => {
    const newtabUrl = chrome.runtime.getURL('newtab.html')
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    await chrome.tabs.create({ url: newtabUrl })
    if (currentTab.id) {
      await chrome.tabs.remove(currentTab.id)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative border-border/40 border-b">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="space-y-8 text-center">
            {/* Header */}
            <div className="space-y-6">
              <PillIndicator
                text="WELCOME"
                className={`transition-all delay-100 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              />

              <div className="space-y-4">
                <h1
                  className={cn(
                    'font-bold text-4xl leading-tight tracking-tight md:text-5xl',
                    'transition-all delay-200 duration-700 md:text-7xl',
                    mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
                  )}
                >
                  Why Switch to{' '}
                  <span className="text-[var(--accent-orange)]">
                    BrowserOS?
                  </span>
                </h1>
                <p
                  className={cn(
                    'mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed',
                    'transition-all delay-300 duration-700',
                    mounted
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-4 opacity-0',
                  )}
                >
                  Watch our launch video to understand the vision of BrowserOS
                  and key features!
                </p>
              </div>
            </div>

            {/* Centered Large Video */}
            <VideoFrame
              title="browseros.com/demo"
              className={cn(
                'transition-all delay-500 duration-700',
                mounted
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-4 opacity-0',
              )}
            >
              <video
                className="h-full w-full"
                src={BROWSER_OS_INTRO_VIDEO_URL}
                title="BrowserOS MCP Server Demonstration"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            </VideoFrame>
          </div>
        </div>

        <div
          className={cn(
            'animation-duration-[3s] absolute bottom-0.5 left-1/2 flex -translate-x-1/2 animate-bounce flex-col items-center gap-3',
            'transition-opacity delay-[2000ms] duration-700',
            mounted ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="text-center">
            <p className="mb-2 font-medium text-muted-foreground text-xs">
              Scroll for Features
            </p>
            <ArrowDown className="mx-auto h-6 w-6 text-[var(--accent-orange)]" />
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="mb-12 space-y-3 text-center">
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            FEATURES
          </p>
          <h2 className="font-bold text-3xl tracking-tight md:text-4xl">
            Explore What&apos;s{' '}
            <span className="text-[var(--accent-orange)]">Possible</span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Skim the highlights below, then click any card to see a focused
            walkthrough with video and deeper details.
          </p>
        </div>

        {/* Bento Grid */}
        {mounted && (
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <BentoCard
                key={feature.id}
                feature={feature}
                mounted={mounted}
                index={index}
              />
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            💡 Tip: Click any card to open a focused walkthrough with video
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl border-border/40 border-y px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-3">
            <LinkIcon className="h-6 w-6 text-[var(--accent-orange)]" />
            <h2 className="font-bold text-3xl">
              Join our community and help us improve{' '}
              <span className="text-[var(--accent-orange)]">BrowserOS!</span>
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Discord */}
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="community-card group flex items-start gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent-orange)]/50 hover:bg-card/80 hover:shadow-[var(--accent-orange)]/5 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all group-hover:scale-110">
                <img
                  src={DiscordLogo}
                  className="h-full w-full"
                  alt="discord-logo"
                />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg transition-colors group-hover:text-[var(--accent-orange)]">
                  Join Discord
                </h3>
                <p className="text-muted-foreground text-sm">
                  To suggest features / provide feedback
                </p>
              </div>
            </a>

            {/* Slack */}
            <a
              href={slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="community-card group flex items-start gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent-orange)]/50 hover:bg-card/80 hover:shadow-[var(--accent-orange)]/5 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all group-hover:scale-110">
                <img
                  src={SlackLogo}
                  className="h-full w-full"
                  alt="slack-logo"
                />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg transition-colors group-hover:text-[var(--accent-orange)]">
                  Join Slack
                </h3>
                <p className="text-muted-foreground text-sm">
                  To suggest features / provide feedback
                </p>
              </div>
            </a>

            {/* GitHub */}
            <a
              href={productRepositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="community-card group flex items-start gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent-orange)]/50 hover:bg-card/80 hover:shadow-[var(--accent-orange)]/5 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/10 transition-all group-hover:scale-110 group-hover:bg-foreground/20">
                <img
                  src={GithubLogo}
                  className="h-full w-full"
                  alt="github-logo"
                />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg transition-colors group-hover:text-[var(--accent-orange)]">
                  GitHub
                </h3>
                <p className="text-muted-foreground text-sm">
                  Star our repository
                </p>
              </div>
            </a>

            {/* Documentation */}
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="community-card group flex items-start gap-4 rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent-orange)]/50 hover:bg-card/80 hover:shadow-[var(--accent-orange)]/5 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-orange)]/10 transition-all group-hover:scale-110 group-hover:bg-[var(--accent-orange)]/20">
                <BookOpenText className="h-6 w-6 text-[var(--accent-orange)]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg transition-colors group-hover:text-[var(--accent-orange)]">
                  Documentation
                </h3>
                <p className="text-muted-foreground text-sm">Learn more</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-16 pb-56">
        <div className="space-y-4 text-center">
          <Button
            onClick={handleStart}
            size="lg"
            className="bg-[var(--accent-orange)] text-white shadow-[var(--accent-orange)]/25 shadow-lg hover:bg-[var(--accent-orange)]/90"
          >
            Start Using BrowserOS
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  )
}
