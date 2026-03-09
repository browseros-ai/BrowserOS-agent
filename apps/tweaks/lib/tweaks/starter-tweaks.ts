import type { TweakRecord } from './types'

function buildStarterTweak(
  id: string,
  input: Pick<
    TweakRecord,
    'name' | 'description' | 'domains' | 'kind' | 'code'
  >,
): TweakRecord {
  const now = new Date().toISOString()
  return {
    id,
    ...input,
    enabled: false,
    source: 'starter',
    createdAt: now,
    updatedAt: now,
    starterId: id,
  }
}

export const STARTER_TWEAKS: TweakRecord[] = [
  buildStarterTweak('starter-google-cleanup', {
    name: 'Google Search Cleanup',
    description:
      'Hide common sponsored blocks and noisy side sections for a cleaner search page.',
    domains: ['google.com'],
    kind: 'css',
    code: `#tads,
#tadsb,
#bottomads,
[data-text-ad],
[aria-label="Ads"],
#rhs,
div[data-attrid*="ai_overview"],
div[data-attrid*="kc:/search/search_features:ai"] {
  display: none !important;
}

#rcnt,
#center_col {
  max-width: 920px !important;
}

#search {
  margin-inline: auto !important;
}`,
  }),
  buildStarterTweak('starter-youtube-focus', {
    name: 'YouTube Focus Mode',
    description:
      'Trim Shorts, side rails, and recommendation clutter for a calmer YouTube session.',
    domains: ['youtube.com'],
    kind: 'css',
    code: `ytd-rich-shelf-renderer[is-shorts],
ytd-reel-shelf-renderer,
a[href="/shorts"],
ytd-mini-guide-entry-renderer a[title="Shorts"],
ytd-watch-next-secondary-results-renderer,
ytd-merch-shelf-renderer,
ytd-comments-entry-point-header-renderer {
  display: none !important;
}

ytd-watch-flexy #columns,
ytd-watch-flexy #primary {
  max-width: 1280px !important;
}

ytd-watch-flexy[is-two-columns_] #secondary {
  display: none !important;
}`,
  }),
  buildStarterTweak('starter-hn-reading-mode', {
    name: 'Hacker News Reading Mode',
    description:
      'Widen the layout, lift the typography, and give Hacker News a warmer reading surface.',
    domains: ['news.ycombinator.com'],
    kind: 'css',
    code: `html, body {
  background: #f7f0e3 !important;
  color: #2e2116 !important;
}

body > center > table,
#hnmain {
  width: min(1100px, 96vw) !important;
  background: transparent !important;
}

.pagetop,
.subtext,
.athing .titleline > a,
.titlelink {
  font-size: 16px !important;
}

.athing .titleline > a,
.titlelink {
  font-size: 19px !important;
  font-family: Georgia, serif !important;
}

td.default,
span.comhead,
.comment {
  line-height: 1.65 !important;
}`,
  }),
]
