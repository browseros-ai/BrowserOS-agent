import { ArrowRight, Sparkles, Zap } from 'lucide-react'
import type { FC } from 'react'
import { NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import { openSidePanel } from '@/lib/browseros/toggleSidePanel'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepThreeProps {
  direction: StepDirection
}

type ExampleMode = 'chat-mode' | 'agent-mode'

const runExample = async ({
  url,
  mode,
  query,
}: {
  url: string
  mode: ExampleMode
  query: string
}) => {
  try {
    const newTab = await chrome.tabs.create({
      url,
      active: true,
    })
    if (!newTab.id) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 1500))

    const isChatMode = mode === 'chat-mode'

    // TODO: Setup a typesafe messaging system
    await chrome.runtime.sendMessage({
      type: 'NEWTAB_EXECUTE_QUERY',
      tabId: newTab.id,
      query: query,
      chatMode: isChatMode,
      metadata: {
        source: 'onboarding',
        executionMode: 'dynamic',
      },
    })

    await openSidePanel(newTab.id)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    return
  } catch (error) {
    // TODO: Record error to error recording service
    // biome-ignore lint/suspicious/noConsole: error recording service not setup yet
    console.error('Error running example:', error)
    return
  }
}

export const StepThree: FC<StepThreeProps> = ({ direction }) => {
  const runChatModeExample = () => {
    runExample({
      url: 'https://news.google.com',
      mode: 'chat-mode',
      query: "summarize today's news",
    })
  }

  const runAgentModeExample = () => {
    runExample({
      url: 'chrome://newtab/',
      mode: 'agent-mode',
      query: 'Navigate to amazon.com and order tide pods',
    })
  }

  return (
    <StepTransition direction={direction}>
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="font-bold text-3xl tracking-tight md:text-4xl">
            Experience the AI Agent
          </h2>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            Built-in AI agent that executes complex web tasks
          </p>
        </div>

        {/* Example cards */}
        <div className="grid gap-4 py-4 md:grid-cols-2">
          <div className="group relative overflow-hidden rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-blue-100/40 p-6 transition-all hover:border-blue-400/50 hover:shadow-lg dark:border-blue-900/50 dark:from-blue-950/40 dark:to-blue-900/20">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 shadow-sm">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <Button
                  onClick={runChatModeExample}
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                >
                  Try it
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-base">Chat Mode</h3>
                <p className="mb-3 text-muted-foreground text-xs">
                  Summarize pages instantly
                </p>
                <div className="rounded-md border border-border/50 bg-background/60 p-2.5">
                  <code className="font-mono text-foreground text-xs">
                    &quot;summarize today&apos;s news&quot;
                  </code>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-orange-200/50 bg-gradient-to-br from-orange-50/80 to-orange-100/40 p-6 transition-all hover:border-orange-400/50 hover:shadow-lg dark:border-orange-900/50 dark:from-orange-950/40 dark:to-orange-900/20">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-orange)] shadow-sm">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <Button
                  onClick={runAgentModeExample}
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                >
                  Try it
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-base">Agent Mode</h3>
                <p className="mb-3 text-muted-foreground text-xs">
                  Execute web automation
                </p>
                <div className="rounded-md border border-border/50 bg-background/60 p-2.5">
                  <code className="font-mono text-foreground text-xs">
                    &quot;Navigate to amazon.com and order tide pods&quot;
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="flex justify-center pt-2">
          <Button
            asChild
            className="h-11 bg-[var(--accent-orange)] px-8 text-white shadow-[var(--accent-orange)]/25 shadow-lg hover:bg-[var(--accent-orange)]/90"
          >
            <NavLink to="/features">
              Explore Features
              <ArrowRight className="ml-2 h-4 w-4" />
            </NavLink>
          </Button>
        </div>
      </div>
    </StepTransition>
  )
}
