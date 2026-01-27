/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Context } from '../types/context'
import type { Response } from '../types/response'

export const getBookmarks = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_bookmarks',
  description: 'Get all bookmarks from the browser',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: true,
  },
  schema: {
    folderId: z
      .string()
      .optional()
      .describe('Optional folder ID to get bookmarks from (omit for all)'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { folderId, windowId } = request.params as {
      folderId?: string
      windowId?: number
    }

    const result = await context.executeAction('getBookmarks', {
      folderId,
      windowId,
    })
    const data = result as {
      bookmarks: Array<{
        id: string
        title: string
        url?: string
        parentId?: string
      }>
    }

    response.appendResponseLine(`Found ${data.bookmarks.length} bookmarks:`)
    response.appendResponseLine('')

    for (const bookmark of data.bookmarks) {
      if (bookmark.url) {
        response.appendResponseLine(`[${bookmark.id}] ${bookmark.title}`)
        response.appendResponseLine(`    ${bookmark.url}`)
      } else {
        response.appendResponseLine(
          `[${bookmark.id}] 📁 ${bookmark.title} (folder)`,
        )
      }
    }
  },
})

export const createBookmark = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_create_bookmark',
  description:
    'Create a new bookmark. Use parentId to place it inside an existing folder or a newly created one.',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    title: z.string().describe('Bookmark title'),
    url: z.string().describe('URL to bookmark'),
    parentId: z
      .string()
      .optional()
      .describe(
        'Folder ID to create bookmark in (from browser_get_bookmarks or browser_create_bookmark_folder)',
      ),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { title, url, parentId, windowId } = request.params as {
      title: string
      url: string
      parentId?: string
      windowId?: number
    }

    const result = await context.executeAction('createBookmark', {
      title,
      url,
      parentId,
      windowId,
    })
    const data = result as { id: string; title: string; url: string }

    response.appendResponseLine(`Created bookmark: ${data.title}`)
    response.appendResponseLine(`URL: ${data.url}`)
    response.appendResponseLine(`ID: ${data.id}`)
  },
})

export const removeBookmark = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_remove_bookmark',
  description: 'Remove a bookmark by ID',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    bookmarkId: z.string().describe('Bookmark ID to remove'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { bookmarkId, windowId } = request.params as {
      bookmarkId: string
      windowId?: number
    }

    await context.executeAction('removeBookmark', { id: bookmarkId, windowId })

    response.appendResponseLine(`Removed bookmark ${bookmarkId}`)
  },
})

export const updateBookmark = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_update_bookmark',
  description: 'Update a bookmark title or URL',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    bookmarkId: z.string().describe('Bookmark ID to update'),
    title: z.string().optional().describe('New title for the bookmark'),
    url: z.string().url().optional().describe('New URL for the bookmark'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { bookmarkId, title, url, windowId } = request.params as {
      bookmarkId: string
      title?: string
      url?: string
      windowId?: number
    }

    const result = await context.executeAction('updateBookmark', {
      id: bookmarkId,
      title,
      url,
      windowId,
    })
    const data = result as { id: string; title: string; url?: string }

    response.appendResponseLine(`Updated bookmark: ${data.title}`)
    if (data.url) {
      response.appendResponseLine(`URL: ${data.url}`)
    }
    response.appendResponseLine(`ID: ${data.id}`)
  },
})

export const createBookmarkFolder = defineTool<
  z.ZodRawShape,
  Context,
  Response
>({
  name: 'browser_create_bookmark_folder',
  description:
    'Create a new bookmark folder. Returns folderId to use as parentId when creating or moving bookmarks into this folder.',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    title: z.string().describe('Folder name'),
    parentId: z
      .string()
      .optional()
      .describe('Parent folder ID (defaults to Bookmarks Bar)'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { title, parentId, windowId } = request.params as {
      title: string
      parentId?: string
      windowId?: number
    }

    const result = await context.executeAction('createBookmarkFolder', {
      title,
      parentId,
      windowId,
    })
    const data = result as {
      id: string
      title: string
      parentId?: string
    }

    response.appendResponseLine(`Created folder: ${data.title}`)
    response.appendResponseLine(`ID: ${data.id}`)
    if (data.parentId) {
      response.appendResponseLine(`Parent: ${data.parentId}`)
    }
  },
})

export const getBookmarkChildren = defineTool<z.ZodRawShape, Context, Response>(
  {
    name: 'browser_get_bookmark_children',
    description: 'Get direct children of a bookmark folder',
    annotations: {
      category: ToolCategories.BOOKMARKS,
      readOnlyHint: true,
    },
    schema: {
      folderId: z.string().describe('Folder ID to get children from'),
      windowId: z.number().optional().describe('Window ID for routing'),
    },
    handler: async (request, response, context) => {
      const { folderId, windowId } = request.params as {
        folderId: string
        windowId?: number
      }

      const result = await context.executeAction('getBookmarkChildren', {
        folderId,
        windowId,
      })
      const data = result as {
        children: Array<{
          id: string
          title: string
          url?: string
          isFolder: boolean
        }>
        count: number
      }

      response.appendResponseLine(`Folder contains ${data.count} items:`)
      response.appendResponseLine('')

      for (const child of data.children) {
        if (child.isFolder) {
          response.appendResponseLine(
            `[${child.id}] 📁 ${child.title} (folder)`,
          )
        } else {
          response.appendResponseLine(`[${child.id}] ${child.title}`)
          if (child.url) {
            response.appendResponseLine(`    ${child.url}`)
          }
        }
      }
    },
  },
)

export const moveBookmark = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_move_bookmark',
  description:
    'Move a bookmark or folder into a different folder (existing or newly created).',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    bookmarkId: z.string().describe('Bookmark or folder ID to move'),
    parentId: z
      .string()
      .optional()
      .describe(
        'Destination folder ID (from browser_get_bookmarks or browser_create_bookmark_folder)',
      ),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Position within parent (0-based)'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { bookmarkId, parentId, index, windowId } = request.params as {
      bookmarkId: string
      parentId?: string
      index?: number
      windowId?: number
    }

    const result = await context.executeAction('moveBookmark', {
      id: bookmarkId,
      parentId,
      index,
      windowId,
    })
    const data = result as {
      id: string
      title: string
      parentId?: string
      index?: number
    }

    response.appendResponseLine(`Moved: ${data.title}`)
    if (data.parentId) {
      response.appendResponseLine(`New parent: ${data.parentId}`)
    }
    if (data.index !== undefined) {
      response.appendResponseLine(`Position: ${data.index}`)
    }
  },
})

export const removeBookmarkTree = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_remove_bookmark_tree',
  description:
    'Remove a bookmark folder and all its contents recursively. Requires confirm: true.',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    folderId: z.string().describe('Folder ID to remove'),
    confirm: z.boolean().describe('Must be true to confirm recursive deletion'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { folderId, confirm, windowId } = request.params as {
      folderId: string
      confirm: boolean
      windowId?: number
    }

    const result = await context.executeAction('removeBookmarkTree', {
      id: folderId,
      confirm,
      windowId,
    })
    const data = result as {
      success: boolean
      message: string
    }

    response.appendResponseLine(data.message)
  },
})
