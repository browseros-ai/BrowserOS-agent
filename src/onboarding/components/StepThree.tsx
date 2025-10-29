import React, { useState } from 'react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { NavigationControls } from './ui/NavigationControls'

export function StepThree() {
  const { nextStep, previousStep } = useOnboardingStore()
  const [executingExample, setExecutingExample] = useState<string | null>(null)

  const exampleQueries = [
    {
      id: 'chat-mode',
      title: 'Summarize Pages with Chat mode',
      description: 'Extract today\'s news from Google News',
      query: 'summarize today\'s news',
      url: 'https://news.google.com',
      clickable: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-500/10 to-blue-600/10',
      hoverBorder: 'hover:border-blue-500/60'
    },
    {
      id: 'agent-mode',
      title: 'Execute web tasks in Agent Mode',
      description: 'Navigate to amazon.com and order tide pods',
      query: 'Navigate to amazon.com and order tide pods',
      url: 'chrome://newtab/',
      clickable: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      gradient: 'from-brand to-orange-500',
      bgGradient: 'from-brand/10 to-orange-500/10',
      hoverBorder: 'hover:border-brand/60'
    },
    {
      id: 'teach-mode',
      title: 'Teach Mode',
      description: 'BrowserOS has a teach mode where you show our agent a workflow and it can learn and repeat that',
      query: 'Unsubscribe from all promotional emails on my gmail tab',
      clickable: false,
      icon: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      )
    },
    {
      id: 'mcp-server',
      title: 'BrowserOS as MCP server',
      description: 'BrowserOS comes with an in-built MCP server, that you can add to claude code, gemini-cli or cursor. This allows you to control BrowserOS from other apps.',
      query: '(in claude code) "Open LinkedIn.com and extract all my connections and give it as a table"',
      clickable: false,
      icon: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      )
    },
    {
      id: 'split-view',
      title: 'Split-View AI on Any Page',
      description: 'Open ChatGPT, Claude, or Gemini alongside any website. Get help while you work — summarize articles, draft responses, or analyze data without switching tabs.',
      query: '',
      clickable: false,
      icon: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a2 2 0 012-2h12a2 2 0 012 2v6H4V5z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 13h7v6H6a2 2 0 01-2-2v-4zm9 0h7v4a2 2 0 01-2 2h-5v-6z"
          />
        </svg>
      )
    },
    {
      id: 'private-default',
      title: 'Private by Default',
      description: 'Run AI locally with Ollama or bring your own API keys. Your data never leaves your machine unless you choose.',
      query: '',
      clickable: false,
      icon: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 10V8a6 6 0 1112 0v2m-1 0h-10a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2z"
          />
        </svg>
      )
    }
  ]

  const handleTryExample = async (example: typeof exampleQueries[0]) => {
    try {
      setExecutingExample(example.id)

      // Create a new tab with the specified URL
      const newTab = await chrome.tabs.create({
        url: example.url,
        active: true
      })

      if (!newTab?.id) {
        setExecutingExample(null)
        return
      }

      // Wait for the tab to load
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Determine if this should be chat mode or browse mode
      const chatMode = example.id === 'chat-mode'

      await chrome.runtime.sendMessage({
        type: 'NEWTAB_EXECUTE_QUERY',
        tabId: newTab.id,
        query: example.query,
        chatMode: chatMode,
        metadata: {
          source: 'onboarding',
          executionMode: 'dynamic'
        }
      })

      await chrome.sidePanel.open({ tabId: newTab.id })

      setTimeout(() => {
        setExecutingExample(null)
      }, 500)
    } catch (error) {
      console.error('[Onboarding] Error executing example:', error)
      setExecutingExample(null)
    }
  }

  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center space-y-4 pt-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Experience the AI Agent
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          BrowserOS comes with a built-in AI agent that can execute complex web tasks!
        </p>
      </div>

      {/* Try These Examples Section */}
      <div className="space-y-5">
        <div className="text-center">
          <h3 className="text-2xl font-bold">Try These Examples</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exampleQueries.filter(ex => ex.clickable).map((example, index) => {
            const isExecuting = executingExample === example.id

            return (
              <button
                key={example.id}
                onClick={() => handleTryExample(example)}
                disabled={isExecuting}
                className={`group relative flex flex-col bg-gradient-to-br ${example.bgGradient} border-2 border-border/60 ${example.hoverBorder} rounded-xl p-5 text-left transition-all duration-300 hover:shadow-xl hover:shadow-brand/10 hover:-translate-y-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
              >
                {/* Icon, Title & Calls to action */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${example.gradient} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      {example.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-base mb-1 leading-tight">{example.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {example.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 self-start">
                    {isExecuting ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/20 text-brand rounded-full text-xs font-semibold border border-brand/40">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Opening...
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-background/80 border border-border/50 rounded-full text-xs font-semibold text-muted-foreground group-hover:text-brand group-hover:border-brand/40 group-hover:bg-brand/10 transition-all duration-200">
                        Try it
                        <svg className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Example Query */}
                <div className="mt-auto">
                  <div className="p-2.5 bg-card/95 backdrop-blur-sm border-2 border-border rounded-lg shadow-sm">
                    <p className="text-xs font-mono text-foreground font-medium leading-relaxed">
                      "{example.query}"
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <NavigationControls onPrevious={previousStep} onNext={nextStep} />
    </div>
  )
}
