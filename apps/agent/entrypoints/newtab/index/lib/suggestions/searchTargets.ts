import { getFaviconUrl } from '@/lib/llm-hub/storage'
import type { SearchTargetKind } from './types'

interface SearchTargetConfig {
  id: string
  label: string
  kind: SearchTargetKind
  iconUrl?: string
  buildUrl: (query: string) => string
}

const iconFrom = (url: string) => getFaviconUrl(url)

const buildQueryUrl =
  (base: string, param = 'q') =>
  (query: string) => {
    const url = new URL(base)
    url.searchParams.set(param, query)
    return url.toString()
  }

const SEARCH_ENGINE_TARGETS: SearchTargetConfig[] = [
  {
    id: 'google',
    label: 'Google',
    kind: 'search',
    iconUrl: iconFrom('https://www.google.com'),
    buildUrl: buildQueryUrl('https://www.google.com/search', 'q'),
  },
  {
    id: 'bing',
    label: 'Bing',
    kind: 'search',
    iconUrl: iconFrom('https://www.bing.com'),
    buildUrl: buildQueryUrl('https://www.bing.com/search', 'q'),
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    kind: 'search',
    iconUrl: iconFrom('https://duckduckgo.com'),
    buildUrl: buildQueryUrl('https://duckduckgo.com/', 'q'),
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    kind: 'search',
    iconUrl: iconFrom('https://search.yahoo.com'),
    buildUrl: buildQueryUrl('https://search.yahoo.com/search', 'p'),
  },
  {
    id: 'brave',
    label: 'Brave Search',
    kind: 'search',
    iconUrl: iconFrom('https://search.brave.com'),
    buildUrl: buildQueryUrl('https://search.brave.com/search', 'q'),
  },
  {
    id: 'kagi',
    label: 'Kagi',
    kind: 'search',
    iconUrl: iconFrom('https://kagi.com'),
    buildUrl: buildQueryUrl('https://kagi.com/search', 'q'),
  },
  {
    id: 'startpage',
    label: 'Startpage',
    kind: 'search',
    iconUrl: iconFrom('https://www.startpage.com'),
    buildUrl: buildQueryUrl('https://www.startpage.com/sp/search', 'query'),
  },
  {
    id: 'ecosia',
    label: 'Ecosia',
    kind: 'search',
    iconUrl: iconFrom('https://www.ecosia.org'),
    buildUrl: buildQueryUrl('https://www.ecosia.org/search', 'q'),
  },
  {
    id: 'qwant',
    label: 'Qwant',
    kind: 'search',
    iconUrl: iconFrom('https://www.qwant.com'),
    buildUrl: buildQueryUrl('https://www.qwant.com/', 'q'),
  },
  {
    id: 'mojeek',
    label: 'Mojeek',
    kind: 'search',
    iconUrl: iconFrom('https://www.mojeek.com'),
    buildUrl: buildQueryUrl('https://www.mojeek.com/search', 'q'),
  },
  {
    id: 'yandex',
    label: 'Yandex',
    kind: 'search',
    iconUrl: iconFrom('https://yandex.com'),
    buildUrl: buildQueryUrl('https://yandex.com/search/', 'text'),
  },
  {
    id: 'baidu',
    label: 'Baidu',
    kind: 'search',
    iconUrl: iconFrom('https://www.baidu.com'),
    buildUrl: buildQueryUrl('https://www.baidu.com/s', 'wd'),
  },
  {
    id: 'you',
    label: 'You.com',
    kind: 'search',
    iconUrl: iconFrom('https://you.com'),
    buildUrl: buildQueryUrl('https://you.com/search', 'q'),
  },
]

const LLM_TARGETS: SearchTargetConfig[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    kind: 'llm',
    iconUrl: iconFrom('https://chatgpt.com'),
    buildUrl: (query: string) => {
      const url = new URL('https://chatgpt.com/')
      url.searchParams.set('hints', 'search')
      url.searchParams.set('prompt', query)
      return url.toString()
    },
  },
  {
    id: 'claude',
    label: 'Claude',
    kind: 'llm',
    iconUrl: iconFrom('https://claude.ai'),
    buildUrl: buildQueryUrl('https://claude.ai/new', 'q'),
  },
  {
    id: 'gemini',
    label: 'Gemini',
    kind: 'llm',
    iconUrl: iconFrom('https://gemini.google.com'),
    buildUrl: buildQueryUrl('https://gemini.google.com/app', 'q'),
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    kind: 'llm',
    iconUrl: iconFrom('https://www.perplexity.ai'),
    buildUrl: buildQueryUrl('https://www.perplexity.ai/search', 'q'),
  },
  {
    id: 'grok',
    label: 'Grok',
    kind: 'llm',
    iconUrl: iconFrom('https://grok.com'),
    buildUrl: buildQueryUrl('https://grok.com', 'q'),
  },
]

export const SEARCH_TARGETS: SearchTargetConfig[] = [
  ...SEARCH_ENGINE_TARGETS,
  ...LLM_TARGETS,
]
