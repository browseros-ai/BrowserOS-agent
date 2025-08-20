import { z } from 'zod'
import { TemplateSchema, type Template } from '@/newtab/schemas/template.schema'

// Validate templates at runtime
const TEMPLATES: Template[] = z.array(TemplateSchema).parse([
  {
    id: 'linkedin-posts-summariser',
    name: 'LinkedIn summariser',
    description: 'Summarise latest posts from your LinkedIn feed',
    goal: 'Summarise key posts from the LinkedIn home feed.',
    steps: [
      'Navigate to https://www.linkedin.com/.',
      'If not logged in, ask the user to sign in and resume.',
      'Scroll 3 times to load content.',
      'Extract page content.',
      'Summarise key posts concisely with author names.'
    ],
    notes: [
      "Be concise; don't use slang.",
      'Skip ads and suggested follows.'
    ]
  },
  {
    id: 'twitter-trends-summariser',
    name: 'Twitter/X Key Trends',
    description: 'Capture trending topics and representative tweets',
    goal: 'Identify today’s key trending topics on Twitter/X.',
    steps: [
      'Navigate to https://x.com/',
      'If a sign-in prompt appears, ask the user to log in and resume.',
      'Scroll 3 times to load content.',
      'Extract page content.',
      'Summarise key trends in short bullets.'
    ],
    notes: [
      'Be neutral; avoid speculation.',
      'Skip NSFW or sensitive topics when unclear.'
    ]
  },
  {
    id: 'google-news-summariser',
    name: 'Google News Summariser',
    description: 'Summarise top headlines across sections',
    goal: 'Summarise the top headlines from Google News.',
    steps: [
      'Navigate to https://news.google.com/.',
      'Extract page content.',
      'Summarise major headlines with sources.'
    ],
    notes: [
      'Be concise and factual; no emojis.'
    ]
  },
  {
    id: 'calendar-daily-digest',
    name: 'Calendar Daily Digest',
    description: 'Summarise today’s meetings with time and attendees',
    goal: 'Produce a short daily brief for today’s Google Calendar events.',
    steps: [
      'Navigate to https://calendar.google.com/.',
      'Extract page content.',
      'Summarise today’s events with time and titles.'
    ],
    notes: [
      'Keep it brief and actionable.'
    ]
  },
  {
    id: 'gmail-unread-today',
    name: 'Gmail Unread Today',
    description: 'Summarise today’s unread emails',
    goal: 'Summarise recent unread emails in the inbox.',
    steps: [
      'Navigate to https://mail.google.com/.',
      'If not logged in, ask the user to sign in and resume.',
      'Extract page content.',
      'Summarise unread emails with sender, subject, brief gist.'
    ],
    notes: [
      'Be concise; limit sensitive details.',
      'Do not mark emails read or change settings.'
    ]
  },
  {
    id: 'reddit-top-today',
    name: 'Reddit Top Today',
    description: 'Summarise top Reddit posts today',
    goal: 'Summarise top posts from r/popular (Today).',
    steps: [
      'Navigate to https://www.reddit.com/r/popular/.',
      'Scroll 3 times to load content.',
      'Extract page content.',
      'Summarise key posts/themes with subreddit names.'
    ],
    notes: [
      'Avoid NSFW content; skip if unclear.'
    ]
  },
  {
    id: 'youtube-subscriptions-digest',
    name: 'YouTube Subscriptions Digest',
    description: 'Summarise new videos from Subscriptions',
    goal: 'Summarise notable videos from YouTube Subscriptions.',
    steps: [
      'Navigate to https://www.youtube.com/feed/subscriptions.',
      'If not logged in, ask the user to sign in and resume.',
      'Scroll 3 times to load content.',
      'Extract page content.',
      'Summarise videos with channel and title.'
    ],
    notes: [
      'Keep bullets short; no spoilers.'
    ]
  },
  {
    id: 'hackernews-top',
    name: 'Hacker News Top',
    description: 'Summarise top HN stories',
    goal: 'Summarise top stories from Hacker News.',
    steps: [
      'Navigate to https://news.ycombinator.com/.',
      'extract the top 3 stories url and title.',
      'open story 1 in new tab and extract the content and summarise it.',
      'open story 2 in new tab and extract the content and summarise it.',
      'open story 3 in new tab and extract the content and summarise it.',
      'present the summaries in a concise format.'
    ],
    notes: [
      'Be concise and neutral.'
    ]
  },
  {
    id: 'github-notifications-digest',
    name: 'GitHub Notifications Digest',
    description: 'Summarise unread GitHub notifications',
    goal: 'Summarise unread GitHub notifications by repo.',
    steps: [
      'Navigate to https://github.com/notifications.',
      'If not logged in, ask the user to sign in and resume.',
      'Scroll 3 times to load content.',
      'Extract page content.',
      'Summarise notifications with repo, title, and type.'
    ],
    notes: [
      'Do not change read status or unsubscribe.'
    ]
  }
])

export default TEMPLATES
