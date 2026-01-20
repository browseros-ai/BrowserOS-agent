/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BookmarkAdapter } from '@/adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const RemoveBookmarkTreeInputSchema = z.object({
  id: z.string().describe('Folder ID to remove'),
  confirm: z.boolean().describe('Must be true to confirm recursive deletion'),
})

const RemoveBookmarkTreeOutputSchema = z.object({
  success: z.boolean().describe('Whether the folder was removed'),
  message: z.string().describe('Result message'),
})

type RemoveBookmarkTreeInput = z.infer<typeof RemoveBookmarkTreeInputSchema>
type RemoveBookmarkTreeOutput = z.infer<typeof RemoveBookmarkTreeOutputSchema>

export class RemoveBookmarkTreeAction extends ActionHandler<
  RemoveBookmarkTreeInput,
  RemoveBookmarkTreeOutput
> {
  readonly inputSchema = RemoveBookmarkTreeInputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(
    input: RemoveBookmarkTreeInput,
  ): Promise<RemoveBookmarkTreeOutput> {
    if (input.confirm !== true) {
      return {
        success: false,
        message:
          'Recursive deletion requires confirm: true. This will permanently delete the folder and all its contents.',
      }
    }

    await this.bookmarkAdapter.removeBookmarkTree(input.id)

    return {
      success: true,
      message: `Removed folder ${input.id} and all its contents`,
    }
  }
}
