import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  create_bookmark,
  get_bookmarks,
  move_bookmark,
  remove_bookmark,
  search_bookmarks,
  update_bookmark,
} from '../../src/tools/bookmarks'
import { withBrowser } from '../__helpers__/with-browser'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

describe('bookmark tools', () => {
  it('full CRUD lifecycle', async () => {
    await withBrowser(async ({ execute }) => {
      // Create
      const createResult = await execute(create_bookmark, {
        title: 'Test Bookmark',
        url: 'https://example.com/test-bookmark',
      })
      assert.ok(!createResult.isError, textOf(createResult))
      const createText = textOf(createResult)
      assert.ok(createText.includes('Test Bookmark'))
      const idMatch = createText.match(/ID:\s*(\S+)/)
      assert.ok(idMatch, 'Could not extract bookmark ID')
      const bookmarkId = idMatch?.[1]

      // Get
      const getResult = await execute(get_bookmarks, {})
      assert.ok(!getResult.isError, textOf(getResult))
      assert.ok(textOf(getResult).includes('Test Bookmark'))

      // Search
      const searchResult = await execute(search_bookmarks, {
        query: 'Test Bookmark',
      })
      assert.ok(!searchResult.isError, textOf(searchResult))
      assert.ok(textOf(searchResult).includes('Test Bookmark'))

      // Update
      const updateResult = await execute(update_bookmark, {
        id: bookmarkId,
        title: 'Updated Bookmark',
      })
      assert.ok(!updateResult.isError, textOf(updateResult))
      assert.ok(textOf(updateResult).includes('Updated Bookmark'))

      // Remove
      const removeResult = await execute(remove_bookmark, { id: bookmarkId })
      assert.ok(!removeResult.isError, textOf(removeResult))
      assert.ok(textOf(removeResult).includes('Removed'))
    })
  }, 60_000)

  it('create folder and move bookmark into it', async () => {
    await withBrowser(async ({ execute }) => {
      // Create folder
      const folderResult = await execute(create_bookmark, {
        title: 'Test Folder',
      })
      assert.ok(!folderResult.isError, textOf(folderResult))
      assert.ok(textOf(folderResult).includes('folder'))
      const folderId = textOf(folderResult).match(/ID:\s*(\S+)/)?.[1]

      // Create bookmark
      const bmResult = await execute(create_bookmark, {
        title: 'Movable Bookmark',
        url: 'https://example.com/movable',
      })
      const bmId = textOf(bmResult).match(/ID:\s*(\S+)/)?.[1]

      // Move into folder
      const moveResult = await execute(move_bookmark, {
        id: bmId,
        parentId: folderId,
      })
      assert.ok(!moveResult.isError, textOf(moveResult))
      assert.ok(textOf(moveResult).includes('Moved'))

      // Cleanup
      await execute(remove_bookmark, { id: folderId })
    })
  }, 60_000)
})
