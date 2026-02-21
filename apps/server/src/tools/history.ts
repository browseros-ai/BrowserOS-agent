import { z } from 'zod'
import { defineTool } from './framework'

export const search_history = defineTool({
  name: 'search_history',
  description: 'Search browser history by text query',
  input: z.object({
    query: z.string().describe('Search query'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of results to return (default: 100)'),
  }),
  handler: async (args, ctx, response) => {
    const items = await ctx.browser.searchHistory(args.query, args.maxResults)

    if (items.length === 0) {
      response.text(`No history items found matching "${args.query}".`)
      return
    }

    const lines: string[] = [
      `Found ${items.length} history items matching "${args.query}":`,
      '',
    ]

    for (const item of items) {
      const date = item.lastVisitTime
        ? new Date(item.lastVisitTime).toISOString()
        : 'Unknown date'
      lines.push(`[${item.id}] ${item.title || 'Untitled'}`)
      lines.push(`    ${item.url || 'No URL'}`)
      lines.push(`    Last visited: ${date}`)
      if (item.visitCount !== undefined) {
        lines.push(`    Visit count: ${item.visitCount}`)
      }
      lines.push('')
    }

    response.text(lines.join('\n'))
  },
})

export const get_recent_history = defineTool({
  name: 'get_recent_history',
  description: 'Get most recent browser history items',
  input: z.object({
    maxResults: z
      .number()
      .optional()
      .describe('Number of recent items to retrieve (default: 20)'),
  }),
  handler: async (args, ctx, response) => {
    const items = await ctx.browser.getRecentHistory(args.maxResults)

    if (items.length === 0) {
      response.text('No recent history items.')
      return
    }

    const lines: string[] = [
      `Retrieved ${items.length} recent history items:`,
      '',
    ]

    for (const item of items) {
      const date = item.lastVisitTime
        ? new Date(item.lastVisitTime).toISOString()
        : 'Unknown date'
      lines.push(`[${item.id}] ${item.title || 'Untitled'}`)
      lines.push(`    ${item.url || 'No URL'}`)
      lines.push(`    ${date}`)
      if (item.visitCount !== undefined) {
        lines.push(`    Visits: ${item.visitCount}`)
      }
      lines.push('')
    }

    response.text(lines.join('\n'))
  },
})

export const delete_history_url = defineTool({
  name: 'delete_history_url',
  description: 'Delete a specific URL from browser history',
  input: z.object({
    url: z.string().describe('URL to delete from history'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.deleteHistoryUrl(args.url)
    response.text(`Deleted ${args.url} from history`)
  },
})

export const delete_history_range = defineTool({
  name: 'delete_history_range',
  description: 'Delete browser history within a time range',
  input: z.object({
    startTime: z.number().describe('Start time as epoch ms'),
    endTime: z.number().describe('End time as epoch ms'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.deleteHistoryRange(args.startTime, args.endTime)
    const start = new Date(args.startTime).toISOString()
    const end = new Date(args.endTime).toISOString()
    response.text(`Deleted history from ${start} to ${end}`)
  },
})
