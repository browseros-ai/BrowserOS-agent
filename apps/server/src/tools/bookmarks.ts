import { z } from 'zod'
import type { BookmarkNode } from '../browser/bookmarks'
import { defineTool } from './framework'

function formatBookmarkTree(nodes: BookmarkNode[]): string {
  const lines: string[] = []
  for (const node of nodes) {
    if (node.url) {
      lines.push(`[${node.id}] ${node.title}`)
      lines.push(`    ${node.url}`)
    } else {
      lines.push(`[${node.id}] ${node.title} (folder)`)
    }
  }
  return lines.join('\n')
}

export const get_bookmarks = defineTool({
  name: 'get_bookmarks',
  description: 'List all bookmarks in the browser',
  input: z.object({
    folderId: z
      .string()
      .optional()
      .describe('Optional folder ID to get bookmarks from (omit for all)'),
  }),
  handler: async (args, ctx, response) => {
    const bookmarks = await ctx.browser.getBookmarks(args.folderId)
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
  description:
    'Create a new bookmark. Use parentId to place it inside an existing folder.',
  input: z.object({
    title: z.string().describe('Bookmark title'),
    url: z.string().describe('URL to bookmark'),
    parentId: z.string().optional().describe('Folder ID to create bookmark in'),
  }),
  handler: async (args, ctx, response) => {
    const bookmark = await ctx.browser.createBookmark(args)
    response.text(
      `Created bookmark: ${bookmark.title}\nURL: ${bookmark.url ?? args.url}\nID: ${bookmark.id}`,
    )
  },
})

export const remove_bookmark = defineTool({
  name: 'remove_bookmark',
  description: 'Remove a bookmark by ID',
  input: z.object({
    id: z.string().describe('Bookmark ID to remove'),
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

export const create_bookmark_folder = defineTool({
  name: 'create_bookmark_folder',
  description:
    'Create a new bookmark folder. Returns folderId to use as parentId when creating bookmarks.',
  input: z.object({
    title: z.string().describe('Folder name'),
    parentId: z
      .string()
      .optional()
      .describe('Parent folder ID (defaults to Bookmarks Bar)'),
  }),
  handler: async (args, ctx, response) => {
    const folder = await ctx.browser.createBookmarkFolder(args)
    response.text(`Created folder: ${folder.title}\nID: ${folder.id}`)
  },
})

export const get_bookmark_children = defineTool({
  name: 'get_bookmark_children',
  description: 'Get direct children of a bookmark folder',
  input: z.object({
    id: z.string().describe('Folder ID to get children from'),
  }),
  handler: async (args, ctx, response) => {
    const children = await ctx.browser.getBookmarkChildren(args.id)
    if (children.length === 0) {
      response.text('Folder is empty.')
      return
    }
    response.text(
      `Folder contains ${children.length} items:\n\n${formatBookmarkTree(children)}`,
    )
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

export const remove_bookmark_tree = defineTool({
  name: 'remove_bookmark_tree',
  description: 'Remove a bookmark folder and all its contents recursively',
  input: z.object({
    id: z.string().describe('Folder ID to remove'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.removeBookmarkTree(args.id)
    response.text(`Removed folder ${args.id} and all contents`)
  },
})
