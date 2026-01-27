/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BookmarkAdapter } from '@/adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

// Input schema
const UpdateBookmarkInputSchema = z.object({
  id: z.string().describe('Bookmark ID to update'),
  title: z.string().optional().describe('New bookmark title'),
  url: z.string().url().optional().describe('New bookmark URL'),
})

// Output schema
const UpdateBookmarkOutputSchema = z.object({
  id: z.string().describe('Bookmark ID'),
  title: z.string().describe('Updated bookmark title'),
  url: z.string().optional().describe('Updated bookmark URL'),
})

type UpdateBookmarkInput = z.infer<typeof UpdateBookmarkInputSchema>
type UpdateBookmarkOutput = z.infer<typeof UpdateBookmarkOutputSchema>

/**
 * UpdateBookmarkAction - Update a bookmark's title or URL
 *
 * Updates an existing bookmark with new title and/or URL.
 *
 * Input:
 * - id: Bookmark ID to update
 * - title (optional): New title for the bookmark
 * - url (optional): New URL for the bookmark
 *
 * Output:
 * - id: Bookmark ID
 * - title: Updated title
 * - url: Updated URL
 *
 * Usage:
 * Update a bookmark's title or URL (at least one must be provided).
 *
 * Example:
 * {
 *   "id": "123",
 *   "title": "New Title",
 *   "url": "https://www.example.com"
 * }
 * // Returns: { id: "123", title: "New Title", url: "https://www.example.com" }
 */
export class UpdateBookmarkAction extends ActionHandler<
  UpdateBookmarkInput,
  UpdateBookmarkOutput
> {
  readonly inputSchema = UpdateBookmarkInputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: UpdateBookmarkInput): Promise<UpdateBookmarkOutput> {
    const changes: { title?: string; url?: string } = {}

    if (input.title !== undefined) {
      changes.title = input.title
    }
    if (input.url !== undefined) {
      changes.url = input.url
    }

    if (Object.keys(changes).length === 0) {
      throw new Error('At least one of title or url must be provided')
    }

    const updated = await this.bookmarkAdapter.updateBookmark(input.id, changes)

    return {
      id: updated.id,
      title: updated.title,
      url: updated.url,
    }
  }
}
