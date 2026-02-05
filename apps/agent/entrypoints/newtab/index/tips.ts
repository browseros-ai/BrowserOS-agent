export interface Tip {
  id: string
  text: string
  shortcut?: string
}

export const TIP_SHOW_PROBABILITY = 1

const TIP_DISMISSED_KEY = 'tip-dismissed-session'

export const TIPS: Tip[] = [
  {
    id: 'chat-any-page',
    text: 'Press Option+K to open the AI Chat panel on any webpage — it includes full page context.',
    shortcut: '⌥K',
  },
  {
    id: 'compare-models',
    text: 'Press Cmd+Shift+U to open LLM Hub and query multiple AI models side-by-side.',
    shortcut: '⌘⇧U',
  },
  {
    id: 'switch-models',
    text: 'Press Option+L to cycle between AI providers without closing the chat panel.',
    shortcut: '⌥L',
  },
  {
    id: 'screenshot-chat',
    text: 'Use the Image button in Chat to capture the visible page and ask visual questions about it.',
  },
  {
    id: 'copy-page-content',
    text: 'Click the Copy button in Chat to grab all webpage text and paste it into your prompt.',
  },
  {
    id: 'cowork-mode',
    text: 'Enable Cowork and select a folder to let the agent browse the web AND create files in a single task.',
  },
  {
    id: 'scheduled-tasks',
    text: 'Set up Scheduled Tasks to run the agent on a timer — results appear right here on your New Tab.',
  },
  {
    id: 'background-tasks',
    text: 'Scheduled tasks run in a hidden window so they never interrupt your browsing.',
  },
  {
    id: 'claude-code-mcp',
    text: 'Connect BrowserOS to Claude Code with the MCP integration for full browser control from your terminal.',
  },
  {
    id: 'mcp-servers',
    text: 'Add MCP servers for Google Calendar, Gmail, Notion, and more to build multi-service workflows.',
  },
  {
    id: 'import-chrome',
    text: 'Go to chrome://settings/importData to import bookmarks, passwords, and history from Chrome in one click.',
  },
  {
    id: 'ad-blocking',
    text: 'BrowserOS comes with uBlock Origin pre-enabled — blocking 10x more ads than Chrome out of the box.',
  },
  {
    id: 'at-mention-tabs',
    text: 'Type @ in the search bar to mention and attach open tabs as context for your AI queries.',
  },
  {
    id: 'workflows',
    text: 'For complex repeatable tasks, build visual Workflows instead of one-off prompts for consistent results.',
  },
  {
    id: 'model-selection',
    text: 'Use Gemini Flash for quick questions and Claude Opus for complex multi-step agent tasks.',
  },
]

export const shouldShowTip = (): boolean => {
  const dismissed = sessionStorage.getItem(TIP_DISMISSED_KEY)
  if (dismissed) return false
  return Math.random() < TIP_SHOW_PROBABILITY
}

export const dismissTip = () => {
  sessionStorage.setItem(TIP_DISMISSED_KEY, Date.now().toString())
}

export const getRandomTip = (): Tip => {
  const index = Math.floor(Math.random() * TIPS.length)
  return TIPS[index]
}
