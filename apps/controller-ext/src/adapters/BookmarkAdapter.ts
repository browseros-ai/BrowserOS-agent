/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { logger } from '@/utils/logger'

/**
 * BookmarkAdapter - Wrapper for Chrome bookmarks API
 *
 * Responsibilities:
 * - Provide clean Promise-based interface to Chrome bookmarks API
 * - Handle Chrome API errors
 * - Log operations for debugging
 */
export class BookmarkAdapter {
  /**
   * Get all bookmarks as a tree structure
   *
   * @returns Bookmark tree root nodes
   */
  async getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    logger.debug('[BookmarkAdapter] Getting bookmark tree')

    try {
      const tree = await chrome.bookmarks.getTree()
      logger.debug(
        `[BookmarkAdapter] Retrieved bookmark tree with ${tree.length} root nodes`,
      )
      return tree
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to get bookmark tree: ${errorMessage}`,
      )
      throw new Error(`Failed to get bookmark tree: ${errorMessage}`)
    }
  }

  /**
   * Search bookmarks by query
   *
   * @param query - Search query (matches title and URL)
   * @returns Array of matching bookmarks
   */
  async searchBookmarks(
    query: string,
  ): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    logger.debug(`[BookmarkAdapter] Searching bookmarks: "${query}"`)

    try {
      const results = await chrome.bookmarks.search(query)
      logger.debug(
        `[BookmarkAdapter] Found ${results.length} bookmarks matching "${query}"`,
      )
      return results
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to search bookmarks: ${errorMessage}`,
      )
      throw new Error(`Failed to search bookmarks: ${errorMessage}`)
    }
  }

  /**
   * Get bookmark by ID
   *
   * @param id - Bookmark ID
   * @returns Bookmark node
   */
  async getBookmark(id: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
    logger.debug(`[BookmarkAdapter] Getting bookmark: ${id}`)

    try {
      const results = await chrome.bookmarks.get(id)
      if (results.length === 0) {
        throw new Error('Bookmark not found')
      }
      logger.debug(`[BookmarkAdapter] Retrieved bookmark: ${id}`)
      return results[0]
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[BookmarkAdapter] Failed to get bookmark: ${errorMessage}`)
      throw new Error(`Failed to get bookmark: ${errorMessage}`)
    }
  }

  /**
   * Create a new bookmark
   *
   * @param bookmark - Bookmark creation details
   * @returns Created bookmark node
   */
  async createBookmark(bookmark: {
    title: string
    url: string
    parentId?: string
  }): Promise<chrome.bookmarks.BookmarkTreeNode> {
    logger.debug(
      `[BookmarkAdapter] Creating bookmark: ${bookmark.title || 'Untitled'}`,
    )

    try {
      const created = await chrome.bookmarks.create(bookmark)
      logger.debug(
        `[BookmarkAdapter] Created bookmark: ${created.id} - ${created.title}`,
      )
      return created
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to create bookmark: ${errorMessage}`,
      )
      throw new Error(`Failed to create bookmark: ${errorMessage}`)
    }
  }

  /**
   * Remove a bookmark by ID
   *
   * @param id - Bookmark ID to remove
   */
  async removeBookmark(id: string): Promise<void> {
    logger.debug(`[BookmarkAdapter] Removing bookmark: ${id}`)

    try {
      await chrome.bookmarks.remove(id)
      logger.debug(`[BookmarkAdapter] Removed bookmark: ${id}`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to remove bookmark ${id}: ${errorMessage}`,
      )
      throw new Error(`Failed to remove bookmark: ${errorMessage}`)
    }
  }

  /**
   * Update a bookmark
   *
   * @param id - Bookmark ID to update
   * @param changes - Changes to apply
   * @returns Updated bookmark node
   */
  async updateBookmark(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    logger.debug(`[BookmarkAdapter] Updating bookmark: ${id}`)

    try {
      const updated = await chrome.bookmarks.update(id, changes)
      logger.debug(
        `[BookmarkAdapter] Updated bookmark: ${id} - ${updated.title}`,
      )
      return updated
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to update bookmark ${id}: ${errorMessage}`,
      )
      throw new Error(`Failed to update bookmark: ${errorMessage}`)
    }
  }

  /**
   * Get recent bookmarks
   *
   * @param limit - Maximum number of bookmarks to return
   * @returns Array of recent bookmarks
   */
  async getRecentBookmarks(
    limit = 20,
  ): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    logger.debug(`[BookmarkAdapter] Getting ${limit} recent bookmarks`)

    try {
      const tree = await chrome.bookmarks.getTree()
      const bookmarks = this._flattenBookmarkTree(tree)

      // Filter to only URL bookmarks (not folders) and sort by dateAdded
      const urlBookmarks = bookmarks
        .filter((b) => b.url && b.dateAdded)
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        .slice(0, limit)

      logger.debug(
        `[BookmarkAdapter] Found ${urlBookmarks.length} recent bookmarks`,
      )
      return urlBookmarks
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to get recent bookmarks: ${errorMessage}`,
      )
      throw new Error(`Failed to get recent bookmarks: ${errorMessage}`)
    }
  }

  /**
   * Create a bookmark folder
   *
   * @param title - Folder name
   * @param parentId - Parent folder ID (defaults to "1" = Bookmarks Bar)
   * @returns Created folder node
   */
  async createBookmarkFolder(options: {
    title: string
    parentId?: string
  }): Promise<chrome.bookmarks.BookmarkTreeNode> {
    const { title, parentId = '1' } = options
    logger.debug(
      `[BookmarkAdapter] Creating bookmark folder: "${title}" in parent ${parentId}`,
    )

    try {
      const created = await chrome.bookmarks.create({
        title,
        parentId,
      })
      logger.debug(
        `[BookmarkAdapter] Created folder: ${created.id} - ${created.title}`,
      )
      return created
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to create bookmark folder: ${errorMessage}`,
      )
      throw new Error(`Failed to create bookmark folder: ${errorMessage}`)
    }
  }

  /**
   * Get direct children of a folder
   *
   * @param folderId - Folder ID to get children from
   * @returns Array of child nodes
   */
  async getBookmarkChildren(
    folderId: string,
  ): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    logger.debug(`[BookmarkAdapter] Getting children of folder: ${folderId}`)

    try {
      const children = await chrome.bookmarks.getChildren(folderId)
      logger.debug(
        `[BookmarkAdapter] Found ${children.length} children in folder ${folderId}`,
      )
      return children
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to get bookmark children: ${errorMessage}`,
      )
      throw new Error(`Failed to get bookmark children: ${errorMessage}`)
    }
  }

  /**
   * Move a bookmark or folder to a new location
   *
   * @param id - Bookmark or folder ID to move
   * @param destination - New location
   * @returns Updated bookmark node
   */
  async moveBookmark(
    id: string,
    destination: { parentId?: string; index?: number },
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    logger.debug(
      `[BookmarkAdapter] Moving bookmark ${id} to parent ${destination.parentId}, index ${destination.index}`,
    )

    try {
      const moved = await chrome.bookmarks.move(id, destination)
      logger.debug(
        `[BookmarkAdapter] Moved bookmark ${id} to ${moved.parentId}`,
      )
      return moved
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to move bookmark ${id}: ${errorMessage}`,
      )
      throw new Error(`Failed to move bookmark: ${errorMessage}`)
    }
  }

  /**
   * Remove a folder and all its contents recursively
   *
   * @param id - Folder ID to remove
   * @throws if id is a root node ("0", "1", "2")
   */
  async removeBookmarkTree(id: string): Promise<void> {
    const protectedIds = ['0', '1', '2']
    if (protectedIds.includes(id)) {
      throw new Error(
        `Cannot delete protected bookmark folder: ${id}. Root folders (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks) cannot be deleted.`,
      )
    }

    logger.debug(`[BookmarkAdapter] Removing bookmark tree: ${id}`)

    try {
      await chrome.bookmarks.removeTree(id)
      logger.debug(`[BookmarkAdapter] Removed bookmark tree: ${id}`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[BookmarkAdapter] Failed to remove bookmark tree ${id}: ${errorMessage}`,
      )
      throw new Error(`Failed to remove bookmark tree: ${errorMessage}`)
    }
  }

  /**
   * Flatten bookmark tree into array
   * @private
   */
  private _flattenBookmarkTree(
    nodes: chrome.bookmarks.BookmarkTreeNode[],
  ): chrome.bookmarks.BookmarkTreeNode[] {
    const result: chrome.bookmarks.BookmarkTreeNode[] = []

    for (const node of nodes) {
      result.push(node)
      if (node.children) {
        result.push(...this._flattenBookmarkTree(node.children))
      }
    }

    return result
  }
}
