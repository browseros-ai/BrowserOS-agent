import { z } from 'zod'
import type { BookmarkNode } from '../browser/bookmarks'
import { defineTool } from './framework'

function formatBookmarkTree(nodes: BookmarkNode[]): string {
  const lines: string[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      lines.push(`[${node.id}] ${node.title} (folder)`)
    } else {
      lines.push(`[${node.id}] ${node.title}`)
      lines.push(`    ${node.url}`)
    }
  }
  return lines.join('\n')
}

export const get_bookmarks = defineTool({
  name: 'get_bookmarks',
  description: 'List all bookmarks in the browser',
  input: z.object({}),
  handler: async (_args, ctx, response) => {
    const bookmarks = await ctx.browser.getBookmarks()
    if (bookmarks.length === 0) {
      response.text('No bookmarks found.')
      return
    }
    response.text(
      `Found ${bookmarks.length} bookmarks:\n\n${formatBookmarkTree(bookmarks)}`,
    )
  },
})

export const create_bookmark = defineTool({
  name: 'create_bookmark',
  description: 'Create a new bookmark or folder. Omit url to create a folder.',
  input: z.object({
    title: z.string().describe('Bookmark title'),
    url: z
      .string()
      .optional()
      .describe('URL to bookmark (omit to create a folder)'),
    parentId: z.string().optional().describe('Folder ID to create bookmark in'),
  }),
  handler: async (args, ctx, response) => {
    const bookmark = await ctx.browser.createBookmark(args)
    if (bookmark.url) {
      response.text(
        `Created bookmark: ${bookmark.title}\nURL: ${bookmark.url}\nID: ${bookmark.id}`,
      )
    } else {
      response.text(`Created folder: ${bookmark.title}\nID: ${bookmark.id}`)
    }
  },
})

export const remove_bookmark = defineTool({
  name: 'remove_bookmark',
  description: 'Remove a bookmark or folder by ID (recursive)',
  input: z.object({
    id: z.string().describe('Bookmark or folder ID to remove'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.removeBookmark(args.id)
    response.text(`Removed bookmark ${args.id}`)
  },
})

export const update_bookmark = defineTool({
  name: 'update_bookmark',
  description: 'Update a bookmark title or URL',
  input: z.object({
    id: z.string().describe('Bookmark ID to update'),
    title: z.string().optional().describe('New title for the bookmark'),
    url: z.string().optional().describe('New URL for the bookmark'),
  }),
  handler: async (args, ctx, response) => {
    const bookmark = await ctx.browser.updateBookmark(args.id, {
      title: args.title,
      url: args.url,
    })
    response.text(`Updated bookmark: ${bookmark.title}\nID: ${bookmark.id}`)
  },
})

export const move_bookmark = defineTool({
  name: 'move_bookmark',
  description: 'Move a bookmark or folder into a different folder',
  input: z.object({
    id: z.string().describe('Bookmark or folder ID to move'),
    parentId: z.string().optional().describe('Destination folder ID'),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Position within parent (0-based)'),
  }),
  handler: async (args, ctx, response) => {
    const bookmark = await ctx.browser.moveBookmark(args.id, {
      parentId: args.parentId,
      index: args.index,
    })
    response.text(`Moved: ${bookmark.title}`)
  },
})

export const search_bookmarks = defineTool({
  name: 'search_bookmarks',
  description: 'Search bookmarks by title or URL',
  input: z.object({
    query: z
      .string()
      .describe('Search query to find bookmarks by title or URL'),
  }),
  handler: async (args, ctx, response) => {
    const bookmarks = await ctx.browser.searchBookmarks(args.query)
    if (bookmarks.length === 0) {
      response.text(`No bookmarks found matching "${args.query}".`)
      return
    }
    response.text(
      `Found ${bookmarks.length} bookmarks matching "${args.query}":\n\n${formatBookmarkTree(bookmarks)}`,
    )
  },
})
