/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'
import type { ControllerToolContext } from '../../types/controller-tool-context'
import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Response } from '../types/response'

export const searchHistory = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'search_history',
  description: 'Search browser history by text query',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.HISTORY,
    readOnlyHint: true,
  },
  schema: {
    query: z.string().describe('Search query'),
    maxResults: z.coerce
      .number()
      .optional()
      .describe('Maximum number of results to return (default: 100)'),
  },
  handler: async (request, response, context) => {
    const { query, maxResults } = request.params as {
      query: string
      maxResults?: number
    }

    const result = await context.controller.executeAction('searchHistory', {
      query,
      maxResults,
    })
    const data = result as {
      items: Array<{
        id: string
        url?: string
        title?: string
        lastVisitTime?: number
        visitCount?: number
        typedCount?: number
      }>
      count: number
    }

    response.appendResponseLine(
      `Found ${data.count} history items matching "${query}":`,
    )
    response.appendResponseLine('')

    for (const item of data.items) {
      const date = item.lastVisitTime
        ? new Date(item.lastVisitTime).toISOString()
        : 'Unknown date'
      response.appendResponseLine(`[${item.id}] ${item.title || 'Untitled'}`)
      response.appendResponseLine(`    ${item.url || 'No URL'}`)
      response.appendResponseLine(`    Last visited: ${date}`)
      if (item.visitCount !== undefined) {
        response.appendResponseLine(`    Visit count: ${item.visitCount}`)
      }
      response.appendResponseLine('')
    }
  },
})

export const getRecentHistory = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'get_recent_history',
  description: 'Get most recent browser history items',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.HISTORY,
    readOnlyHint: true,
  },
  schema: {
    count: z.coerce
      .number()
      .optional()
      .describe('Number of recent items to retrieve (default: 20)'),
  },
  handler: async (request, response, context) => {
    const { count } = request.params as { count?: number }

    const result = await context.controller.executeAction('getRecentHistory', {
      count,
    })
    const data = result as {
      items: Array<{
        id: string
        url?: string
        title?: string
        lastVisitTime?: number
        visitCount?: number
      }>
      count: number
    }

    response.appendResponseLine(`Retrieved ${data.count} recent history items:`)
    response.appendResponseLine('')

    for (const item of data.items) {
      const date = item.lastVisitTime
        ? new Date(item.lastVisitTime).toISOString()
        : 'Unknown date'
      response.appendResponseLine(`[${item.id}] ${item.title || 'Untitled'}`)
      response.appendResponseLine(`    ${item.url || 'No URL'}`)
      response.appendResponseLine(`    ${date}`)
      if (item.visitCount !== undefined) {
        response.appendResponseLine(`    Visits: ${item.visitCount}`)
      }
      response.appendResponseLine('')
    }
  },
})
