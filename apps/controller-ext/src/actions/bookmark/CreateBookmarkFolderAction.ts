/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BookmarkAdapter } from '@/adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const CreateBookmarkFolderInputSchema = z.object({
  title: z.string().describe('Folder name'),
  parentId: z
    .string()
    .optional()
    .describe('Parent folder ID (defaults to "1" = Bookmarks Bar)'),
})

const CreateBookmarkFolderOutputSchema = z.object({
  id: z.string().describe('Created folder ID'),
  title: z.string().describe('Folder name'),
  parentId: z.string().optional().describe('Parent folder ID'),
  dateAdded: z.number().optional().describe('Creation timestamp'),
})

type CreateBookmarkFolderInput = z.infer<typeof CreateBookmarkFolderInputSchema>
type CreateBookmarkFolderOutput = z.infer<
  typeof CreateBookmarkFolderOutputSchema
>

export class CreateBookmarkFolderAction extends ActionHandler<
  CreateBookmarkFolderInput,
  CreateBookmarkFolderOutput
> {
  readonly inputSchema = CreateBookmarkFolderInputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(
    input: CreateBookmarkFolderInput,
  ): Promise<CreateBookmarkFolderOutput> {
    const created = await this.bookmarkAdapter.createBookmarkFolder({
      title: input.title,
      parentId: input.parentId,
    })

    return {
      id: created.id,
      title: created.title,
      parentId: created.parentId,
      dateAdded: created.dateAdded,
    }
  }
}
