/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BookmarkAdapter } from '@/adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const MoveBookmarkInputSchema = z.object({
  id: z.string().describe('Bookmark or folder ID to move'),
  parentId: z.string().optional().describe('New parent folder ID'),
  index: z.number().int().min(0).optional().describe('Position within parent'),
})

const MoveBookmarkOutputSchema = z.object({
  id: z.string().describe('Moved bookmark ID'),
  title: z.string().describe('Bookmark title'),
  url: z.string().optional().describe('Bookmark URL (undefined if folder)'),
  parentId: z.string().optional().describe('New parent folder ID'),
  index: z.number().optional().describe('New position within parent'),
})

type MoveBookmarkInput = z.infer<typeof MoveBookmarkInputSchema>
type MoveBookmarkOutput = z.infer<typeof MoveBookmarkOutputSchema>

export class MoveBookmarkAction extends ActionHandler<
  MoveBookmarkInput,
  MoveBookmarkOutput
> {
  readonly inputSchema = MoveBookmarkInputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(input: MoveBookmarkInput): Promise<MoveBookmarkOutput> {
    const destination: { parentId?: string; index?: number } = {}
    if (input.parentId !== undefined) destination.parentId = input.parentId
    if (input.index !== undefined) destination.index = input.index

    const moved = await this.bookmarkAdapter.moveBookmark(input.id, destination)

    return {
      id: moved.id,
      title: moved.title,
      url: moved.url,
      parentId: moved.parentId,
      index: moved.index,
    }
  }
}
