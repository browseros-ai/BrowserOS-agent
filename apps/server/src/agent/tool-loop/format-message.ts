import type { BrowserContext } from '@browseros/shared/schemas/browser-context'

export function formatBrowserContext(browserContext?: BrowserContext): string {
  if (!browserContext?.activeTab && !browserContext?.selectedTabs?.length) {
    return ''
  }

  const formatTab = (tab: { id: number; url?: string; title?: string }) =>
    `Tab ${tab.id}${tab.title ? ` - "${tab.title}"` : ''}${tab.url ? ` (${tab.url})` : ''}`

  const lines: string[] = ['## Browser Context']

  if (browserContext.activeTab) {
    lines.push(`**User's Active Tab:** ${formatTab(browserContext.activeTab)}`)
  }

  if (browserContext.selectedTabs?.length) {
    lines.push(
      `**User's Selected Tabs (${browserContext.selectedTabs.length}):**`,
    )
    browserContext.selectedTabs.forEach((tab, i) => {
      lines.push(`  ${i + 1}. ${formatTab(tab)}`)
    })
  }

  return `${lines.join('\n')}\n\n---\n\n`
}

export function formatUserMessage(
  message: string,
  browserContext?: BrowserContext,
): string {
  const contextPrefix = formatBrowserContext(browserContext)
  return `${contextPrefix}<USER_QUERY>\n${message}\n</USER_QUERY>`
}
