import { z } from 'zod'
import { TemplateSchema, type Template } from '@/newtab/schemas/template.schema'

// Validate templates at runtime
const TEMPLATES: Template[] = z.array(TemplateSchema).parse([
  {
    id: 'linkedin-posts-summariser',
    name: 'LinkedIn Posts Summariser',
    description: 'Summarise latest posts from your LinkedIn feed',
    goal: 'Summarise key posts from the LinkedIn home feed in one line each, mentioning the author.',
    steps: [
      'Navigate to https://www.linkedin.com/.',
      'Refresh browser state and ensure you are on the home feed.',
      'If sign-in is required, request human input to log in and resume.',
      'Scroll and extract visible post authors and text the first time.',
      'Scroll and extract content for the second time.',
      'Scroll and extract content for the third time.',
      'Summarise key posts in one bullet each, mentioning the author.'
    ],
    notes: [
      "Be concise; don't use slang.",
      'Skip ads and suggested follows.',
      'Prefer posts with more engagement or longer text.'
    ]
  },
  {
    id: 'twitter-trends-summariser',
    name: 'Twitter/X Key Trends',
    description: 'Capture trending topics and representative tweets',
    goal: 'Identify today’s key trending topics on Twitter/X and summarise the top themes with one representative tweet per theme when available.',
    steps: [
      'Navigate to https://twitter.com/explore/tabs/trending or https://x.com/explore.',
      'Refresh browser state and ensure Trending is selected.',
      'If sign-in prompt appears, request human input and continue.',
      'Extract visible trending topics and brief descriptions the first time.',
      'Scroll and extract additional trends the second time.',
      'Open one or two top trends and extract a representative tweet.',
      'Summarise key trends in bullets with a short note and mention the tweet author when used.'
    ],
    notes: [
      'Be neutral; avoid speculation.',
      'One to two lines per trend.',
      'Skip NSFW or sensitive topics when unclear.'
    ]
  },
  {
    id: 'google-news-summariser',
    name: 'Google News Summariser',
    description: 'Summarise top headlines across sections',
    goal: 'Summarise the top headlines from Google News into 8–10 concise bullets grouped by section (Top stories, World, Business, Tech).',
    steps: [
      'Navigate to https://news.google.com/.',
      'Refresh browser state; confirm you are on Top stories.',
      'Extract visible Top stories headlines and sources the first time.',
      'Scroll and extract additional Top stories for the second time.',
      'Navigate to World/Business/Technology sections and extract headlines.',
      'Optionally open one or two headlines to capture subhead text.',
      'Summarise into grouped bullets citing the source outlet for each.'
    ],
    notes: [
      'Be concise and factual; no emojis.',
      'Include source names; avoid opinionated language.'
    ]
  },
  {
    id: 'calendar-daily-digest',
    name: 'Calendar Daily Digest',
    description: 'Summarise today’s meetings with time and attendees',
    goal: 'Produce a short daily brief for today’s Google Calendar events: time, title, attendees, and quick prep notes.',
    steps: [
      'Navigate to https://calendar.google.com/ and switch to Day view.',
      'Refresh browser state and ensure the date is today.',
      'Extract today’s visible events with time and titles.',
      'Open the first event and extract attendees/description.',
      'Open the second event and extract attendees/description.',
      'Open the third event and extract attendees/description.',
      'Summarise the schedule with bullets and short prep notes.'
    ],
    notes: [
      'Keep it brief and actionable.',
      'Respect privacy; do not share content outside this summary.'
    ]
  },
  {
    id: 'gmail-unread-today',
    name: 'Gmail Unread Today',
    description: 'Summarise today’s unread emails',
    goal: 'Summarise unread emails from the last 24 hours in Gmail with sender, subject, and a one‑line gist.',
    steps: [
      'Navigate to https://mail.google.com/.',
      'If sign-in is required, request human input to log in.',
      'Use the search box for "label:inbox is:unread newer_than:1d" and submit.',
      'Extract the first page of results: sender, subject, preview.',
      'Open the first unread email and extract the first paragraph.',
      'Open the second unread email and extract the first paragraph.',
      'Summarise the unread set as bullets with sender → gist; flag any obvious action items.'
    ],
    notes: [
      'Be concise; no sensitive content beyond brief gist.',
      'Do not mark emails read or take destructive actions.'
    ]
  },
  {
    id: 'reddit-top-today',
    name: 'Reddit Top Today',
    description: 'Summarise top Reddit posts today',
    goal: 'Summarise top posts from r/popular (Today) with themes and representative posts.',
    steps: [
      'Navigate to https://www.reddit.com/r/popular/.',
      'Switch to Top → Today if needed.',
      'Extract visible post titles, upvotes, and subreddit names.',
      'Scroll and extract more posts the second time.',
      'Scroll and extract more posts the third time.',
      'Open one or two high‑upvote posts to capture top comment or summary.',
      'Summarise themes with 1–2 bullets each and cite subreddits.'
    ],
    notes: [
      'Avoid NSFW content; skip if unclear.',
      'Neutral tone; one to two lines per theme.'
    ]
  },
  {
    id: 'youtube-subscriptions-digest',
    name: 'YouTube Subscriptions Digest',
    description: 'Summarise new videos from Subscriptions',
    goal: 'Summarise today’s notable videos from YouTube Subscriptions with channel, title, and why it may be relevant.',
    steps: [
      'Navigate to https://www.youtube.com/feed/subscriptions.',
      'Refresh browser state and filter to Today if available.',
      'Extract visible video cards: channel, title, age, duration.',
      'Scroll and extract additional videos the second time.',
      'Open 1–2 promising videos and extract description snippet.',
      'Optionally capture view counts for prioritisation.',
      'Produce a short digest: channel → title → why it matters.'
    ],
    notes: [
      'Keep bullets short; no spoilers.',
      'Do not autoplay videos or change settings.'
    ]
  },
  {
    id: 'hackernews-top',
    name: 'Hacker News Top',
    description: 'Summarise top HN stories',
    goal: 'Summarise the top Hacker News stories with one‑line takeaways and include the source domain.',
    steps: [
      'Navigate to https://news.ycombinator.com/.',
      'Extract the top 30 list entries: title, score, source domain.',
      'Open the top 3–5 stories in place and extract the first paragraph from the linked page.',
      'Return to the list if needed and continue extraction.',
      'Summarise stories in bullets: title — one‑line takeaway — (source).'
    ],
    notes: [
      'Be concise and neutral.',
      'If target page blocks access, skip and proceed.'
    ]
  },
  {
    id: 'github-notifications-digest',
    name: 'GitHub Notifications Digest',
    description: 'Summarise unread GitHub notifications',
    goal: 'Summarise unread GitHub notifications by repo with the type (PR/issue), title, author, and suggested next action.',
    steps: [
      'Navigate to https://github.com/notifications.',
      'If sign-in is required, request human input to log in.',
      'Ensure Unread filter is active.',
      'Extract visible notification items: repo, title, type, author.',
      'Scroll and extract more notifications the second time.',
      'Open 1–2 items to extract the latest comment or summary.',
      'Summarise by repo with bullets and suggest next actions.'
    ],
    notes: [
      'Do not change read status or unsubscribe.',
      'Keep suggestions lightweight and optional.'
    ]
  },
  {
    id: 'drive-recent-digest',
    name: 'Google Drive Recent Digest',
    description: 'Summarise recently modified Drive files',
    goal: 'Summarise recently modified Google Drive files with file name, owner, and a short reason they might matter.',
    steps: [
      'Navigate to https://drive.google.com/drive/recent.',
      'If sign-in is required, request human input to log in.',
      'Extract the visible recent files list: name, owner, last modified.',
      'Scroll and extract additional items the second time.',
      'Open 1–2 top items to capture a short preview/snippet.',
      'Summarise into bullets with name — owner — brief note.'
    ],
    notes: [
      'Do not move or delete files.',
      'Avoid exposing sensitive content; keep previews minimal.'
    ]
  },
  {
    id: 'google-search-researcher',
    name: 'Google Search Researcher',
    description: 'Quick research digest from Google Search',
    goal: 'Given a query, collect top results and produce a compact research brief with key points and links.',
    steps: [
      'Navigate to https://www.google.com/.',
      'Enter the user\'s query and submit.',
      'Extract the first page of results: titles, snippets, and URLs.',
      'Open the first result and extract key facts.',
      'Open the second result and extract key facts.',
      'Open the third result and extract key facts.',
      'Produce a brief with 5–7 bullets and include source links.'
    ],
    notes: [
      'Be factual; cite sources.',
      'If results look sponsored/ads, skip those entries.'
    ]
  }
])

export default TEMPLATES
