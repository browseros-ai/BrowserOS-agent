import { changelogUrl, productVideoUrl } from '@/lib/constants/productUrls'

export interface ReleaseFeature {
  id: string
  title: string
  description: string
  linkLabel?: string
  linkType?: string
  linkUrl?: string
}

export interface ReleaseNote {
  id: string
  browserosVersion: string
  releaseDate: string
  summary: string
  features?: ReleaseFeature[]
  highlights: string[]
  docsUrl: string
  talksUrl?: string
  talksLabel?: string
}

interface ExtensionWhatsNewConfig {
  releaseId: string
  autoShow: boolean
  showBanner: boolean
}

export interface ConfiguredRelease {
  extensionVersion: string
  release: ReleaseNote
  config: ExtensionWhatsNewConfig
}

function getReleaseAnchor(browserosVersion: string): string {
  return `v${browserosVersion.replaceAll('.', '-')}`
}

function getReleaseDocsUrl(browserosVersion: string): string {
  return `${changelogUrl}#${getReleaseAnchor(browserosVersion)}`
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: '0.41.0',
    browserosVersion: '0.41.0',
    releaseDate: 'March 4, 2026',
    summary:
      'A major release centered on the new agent v3, a much larger tools surface, and overall polish.',
    features: [
      {
        id: 'agent-v3',
        title: 'Agent v3',
        description:
          'The core agent was rebuilt from scratch for much faster execution, more reliable planning, and better task follow-through.',
        linkLabel: 'Watch demo',
        linkType: 'feature-talk',
        linkUrl: productVideoUrl,
      },
      {
        id: 'tools-upgrade',
        title: 'Expanded tools surface',
        description:
          'BrowserOS now ships a much larger toolset, including file upload, save as PDF, background windows, and stronger connectivity to third-party coding agents.',
        linkLabel: 'Read release notes',
        linkType: 'feature-docs',
        linkUrl: getReleaseDocsUrl('0.41.0'),
      },
      {
        id: 'product-polish',
        title: 'Reliability and install polish',
        description:
          'Installation, stability, and the day-to-day product experience were tightened across the release so the update feels smoother end to end.',
      },
      {
        id: 'debian-packaging',
        title: 'Linux packaging fixes',
        description:
          'Remaining Debian packaging issues were cleaned up to make Linux installs and updates more dependable.',
      },
    ],
    highlights: [
      'New agent (v3) rebuilt from scratch for much faster and more reliable task execution.',
      'Major tools upgrade with file upload, save as PDF, background windows, and better third-party coding-agent connectivity.',
      'General fixes across installation, stability, and the day-to-day product experience.',
      'Debian packaging fixes for Linux users.',
    ],
    docsUrl: getReleaseDocsUrl('0.41.0'),
    talksUrl: productVideoUrl,
    talksLabel: 'Watch demo',
  },
  {
    id: '0.40.1',
    browserosVersion: '0.40.1',
    releaseDate: 'February 16, 2026',
    summary:
      'A Chromium and reliability refresh focused on security patches and more dependable login import.',
    features: [
      {
        id: 'chromium-145',
        title: 'Chromium 145 base',
        description:
          'BrowserOS moved onto the Chromium 145 base with the latest upstream fixes and security patches.',
      },
      {
        id: 'login-import',
        title: 'Stronger login imports',
        description:
          'Imported login sessions became more dependable, reducing failures during migration into BrowserOS.',
      },
      {
        id: 'stability-refresh',
        title: 'Stability refresh',
        description:
          'General reliability improvements landed across the app to make the release steadier overall.',
      },
    ],
    highlights: [
      'Upgraded to Chromium 145 with recent upstream fixes and security patches.',
      'Improved login session imports for better reliability.',
      'General stability and reliability improvements across the app.',
    ],
    docsUrl: getReleaseDocsUrl('0.40.1'),
  },
  {
    id: '0.39.0',
    browserosVersion: '0.39.0',
    releaseDate: 'February 3, 2026',
    summary:
      'Sync and app-connection workflows became easier to use and more reliable across machines.',
    features: [
      {
        id: 'sync',
        title: 'Cross-device sync',
        description:
          'Browser configuration, agent history, and scheduled tasks now move with you across machines.',
      },
      {
        id: 'app-connector',
        title: 'Redesigned App Connector',
        description:
          'Connecting MCP apps became easier with a cleaner setup flow and clearer entry points.',
      },
      {
        id: 'mcp-stability',
        title: 'MCP restart stability',
        description:
          'Additional port-handling fixes improved restart reliability and reduced disconnects.',
      },
    ],
    highlights: [
      'Sync now carries browser configuration, agent history, and scheduled tasks across devices.',
      'The App Connector flow was redesigned to make connecting MCP apps easier.',
      'Additional MCP port stability fixes improved restart reliability.',
      'Keyboard shortcuts were updated to avoid conflicts on European keyboards.',
    ],
    docsUrl: getReleaseDocsUrl('0.39.0'),
  },
  {
    id: '0.38.0',
    browserosVersion: '0.38.0',
    releaseDate: 'January 28, 2026',
    summary:
      'A stability release that tightened MCP behavior, browser settings persistence, and core agent reliability.',
    highlights: [
      'Fixed MCP port issues on Windows and Linux.',
      'Fixed `chrome.browser.settings` persistence and application issues.',
      'Improved agent reliability and performance.',
    ],
    docsUrl: getReleaseDocsUrl('0.38.0'),
  },
  {
    id: '0.37.0',
    browserosVersion: '0.37.0',
    releaseDate: 'January 21, 2026',
    summary:
      'Introduced Workflows and Cowork to support repeatable automations and longer-running delegated tasks.',
    highlights: [
      'Workflows added a visual graph builder for repeatable browser automations.',
      'Cowork introduced step-away task execution that combines browser actions with local file work.',
    ],
    docsUrl: getReleaseDocsUrl('0.37.0'),
  },
  {
    id: '0.36.3',
    browserosVersion: '0.36.3',
    releaseDate: 'January 15, 2026',
    summary:
      'Agent history arrived so conversations can be revisited and resumed later.',
    highlights: [
      'Agent conversations are now saved automatically.',
      'Past conversations can be viewed and resumed from the Assistant panel.',
    ],
    docsUrl: getReleaseDocsUrl('0.36.3'),
  },
  {
    id: '0.36.2',
    browserosVersion: '0.36.2',
    releaseDate: 'January 10, 2026',
    summary: 'A focused MCP stability release.',
    highlights: [
      'Fixed MCP server disconnects caused by port handling problems.',
    ],
    docsUrl: getReleaseDocsUrl('0.36.2'),
  },
  {
    id: '0.36.0',
    browserosVersion: '0.36.0',
    releaseDate: 'January 8, 2026',
    summary:
      'Personalization, toolbar customization, and more reliable install/update behavior shipped together.',
    highlights: [
      'Added agent personalization with user-defined prompts and preferences.',
      'Added toolbar customization controls.',
      'Improved MCP server port stability across browser restarts.',
      'Fixed agent install and update issues more proactively.',
    ],
    docsUrl: getReleaseDocsUrl('0.36.0'),
  },
  {
    id: '0.35.0',
    browserosVersion: '0.35.0',
    releaseDate: 'December 25, 2025',
    summary:
      'A reliability-focused release with Gemini 3 support and clearer errors.',
    highlights: [
      'Agent loop stability fixes improved reliability.',
      'Gemini 3 support landed through OpenRouter and Google adapters.',
      'Error messages became clearer and easier to act on.',
    ],
    docsUrl: getReleaseDocsUrl('0.35.0'),
  },
  {
    id: '0.34.0',
    browserosVersion: '0.34.0',
    releaseDate: 'December 20, 2025',
    summary:
      'BrowserOS expanded MCP integrations and added more model-provider support.',
    highlights: [
      'Third-party MCP server support added for apps like Google Calendar, Notion, Google Docs, and Gmail.',
      'Gemini 3 Pro and Flash support arrived.',
      'Agent loop fixes and UI polish improved the overall experience.',
    ],
    docsUrl: getReleaseDocsUrl('0.34.0'),
  },
  {
    id: '0.33.0',
    browserosVersion: '0.33.0',
    releaseDate: 'December 18, 2025',
    summary:
      'Provider flexibility and multi-window agent support improved advanced workflows.',
    highlights: [
      'Added OpenAI-compatible provider support.',
      'Enabled multi-window and multi-profile agent support.',
      'Improved MCP connection reliability and general agent stability.',
    ],
    docsUrl: getReleaseDocsUrl('0.33.0'),
  },
  {
    id: '0.32.0',
    browserosVersion: '0.32.0',
    releaseDate: 'December 12, 2025',
    summary:
      'A major BrowserOS revamp delivered a rebuilt agent, multi-agent support, and a refreshed UI.',
    highlights: [
      'Introduced the rebuilt agent with faster and more reliable behavior.',
      'Added agent-per-tab support for parallel work.',
      'Shipped a polished UI, native split view, Manifest V2 support, Chromium 142, and Azure/AWS Bedrock integrations.',
      'This release included breaking changes requiring an update and LLM-provider reconfiguration.',
    ],
    docsUrl: getReleaseDocsUrl('0.32.0'),
  },
  {
    id: '0.30.0',
    browserosVersion: '0.30.0',
    releaseDate: 'November 14, 2025',
    summary:
      'A cleanup release focused on text extraction, MCP reliability, and a tidier UI.',
    highlights: [
      'Improved text extraction and copy behavior in LLM Chat.',
      'Improved MCP server connection reliability.',
      'Cleaned up the UI and fixed third-party MCP support issues.',
    ],
    docsUrl: getReleaseDocsUrl('0.30.0'),
  },
]

const EXTENSION_WHATS_NEW: Record<string, ExtensionWhatsNewConfig> = {
  '0.0.52': {
    releaseId: '0.41.0',
    autoShow: true,
    showBanner: true,
  },
}

export function getReleaseNumber(browserosVersion: string): string {
  const [, releaseNumber] = browserosVersion.split('.')
  return releaseNumber ?? browserosVersion
}

export function getLatestReleaseNote(): ReleaseNote {
  return RELEASE_NOTES[0]
}

export function getReleaseNoteByBrowserosVersion(
  browserosVersion: string | null | undefined,
): ReleaseNote | null {
  if (!browserosVersion) {
    return null
  }

  return (
    RELEASE_NOTES.find(
      (release) => release.browserosVersion === browserosVersion,
    ) ?? null
  )
}

export function getConfiguredReleaseForExtensionVersion(
  extensionVersion: string,
): ConfiguredRelease | null {
  const config = EXTENSION_WHATS_NEW[extensionVersion]
  if (!config) {
    return null
  }

  const release = getReleaseNoteByBrowserosVersion(config.releaseId)
  if (!release) {
    return null
  }

  return { extensionVersion, config, release }
}

export function shouldAutoShowWhatsNew(extensionVersion: string): boolean {
  return (
    getConfiguredReleaseForExtensionVersion(extensionVersion)?.config
      .autoShow === true
  )
}

export function getReleaseHistory(activeReleaseId?: string): ReleaseNote[] {
  if (!activeReleaseId) {
    return RELEASE_NOTES
  }

  const activeRelease = RELEASE_NOTES.find(
    (release) => release.id === activeReleaseId,
  )
  if (!activeRelease) {
    return RELEASE_NOTES
  }

  return [
    activeRelease,
    ...RELEASE_NOTES.filter((release) => release.id !== activeReleaseId),
  ]
}

type WhatsNewPathOptions = {
  release?: string
  source?: string
}

export function getWhatsNewPath(options: WhatsNewPathOptions = {}): string {
  const params = new URLSearchParams()

  if (options.release) {
    params.set('release', options.release)
  }

  if (options.source) {
    params.set('source', options.source)
  }

  const query = params.toString()
  return query ? `/whats-new?${query}` : '/whats-new'
}

export function getWhatsNewAppUrl(options: WhatsNewPathOptions = {}): string {
  return chrome.runtime.getURL(`app.html#${getWhatsNewPath(options)}`)
}
