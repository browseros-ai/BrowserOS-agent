/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BookmarkAdapter } from '@/adapters/BookmarkAdapter'
import { ActionHandler } from '../ActionHandler'

const GetBookmarkChildrenInputSchema = z.object({
  folderId: z.string().describe('Folder ID to get children from'),
})

const GetBookmarkChildrenOutputSchema = z.object({
  children: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string().optional(),
      parentId: z.string().optional(),
      dateAdded: z.number().optional(),
      isFolder: z.boolean(),
    }),
  ),
  count: z.number(),
})

type GetBookmarkChildrenInput = z.infer<typeof GetBookmarkChildrenInputSchema>
type GetBookmarkChildrenOutput = z.infer<typeof GetBookmarkChildrenOutputSchema>

export class GetBookmarkChildrenAction extends ActionHandler<
  GetBookmarkChildrenInput,
  GetBookmarkChildrenOutput
> {
  readonly inputSchema = GetBookmarkChildrenInputSchema
  private bookmarkAdapter = new BookmarkAdapter()

  async execute(
    input: GetBookmarkChildrenInput,
  ): Promise<GetBookmarkChildrenOutput> {
    const results = await this.bookmarkAdapter.getBookmarkChildren(
      input.folderId,
    )

    const children = results.map((node) => ({
      id: node.id,
      title: node.title,
      url: node.url,
      parentId: node.parentId,
      dateAdded: node.dateAdded,
      isFolder: !node.url,
    }))

    return {
      children,
      count: children.length,
    }
  }
}
