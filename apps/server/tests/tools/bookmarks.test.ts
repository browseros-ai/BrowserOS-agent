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

function structuredOf<T>(result: { structuredContent?: unknown }): T {
  assert.ok(result.structuredContent, 'Expected structuredContent')
  return result.structuredContent as T
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
      const createData = structuredOf<{
        bookmark: { id: string; title: string }
      }>(createResult)
      assert.strictEqual(createData.bookmark.title, 'Test Bookmark')
      const bookmarkId = createData.bookmark.id

      // Get
      const getResult = await execute(get_bookmarks, {})
      assert.ok(!getResult.isError, textOf(getResult))
      const getData = structuredOf<{ bookmarks: Array<{ title: string }> }>(
        getResult,
      )
      assert.ok(
        getData.bookmarks.some(
          (bookmark) => bookmark.title === 'Test Bookmark',
        ),
      )

      // Search
      const searchResult = await execute(search_bookmarks, {
        query: 'Test Bookmark',
      })
      assert.ok(!searchResult.isError, textOf(searchResult))
      const searchData = structuredOf<{ bookmarks: Array<{ id: string }> }>(
        searchResult,
      )
      assert.ok(
        searchData.bookmarks.some((bookmark) => bookmark.id === bookmarkId),
      )

      // Update
      const updateResult = await execute(update_bookmark, {
        id: bookmarkId,
        title: 'Updated Bookmark',
      })
      assert.ok(!updateResult.isError, textOf(updateResult))
      const updateData = structuredOf<{ bookmark: { title: string } }>(
        updateResult,
      )
      assert.strictEqual(updateData.bookmark.title, 'Updated Bookmark')

      // Remove
      const removeResult = await execute(remove_bookmark, { id: bookmarkId })
      assert.ok(!removeResult.isError, textOf(removeResult))
      const removeData = structuredOf<{ action: string; id: string }>(
        removeResult,
      )
      assert.strictEqual(removeData.action, 'remove_bookmark')
      assert.strictEqual(removeData.id, bookmarkId)
    })
  }, 60_000)

  it('create folder and move bookmark into it', async () => {
    await withBrowser(async ({ execute }) => {
      // Create folder
      const folderResult = await execute(create_bookmark, {
        title: 'Test Folder',
      })
      assert.ok(!folderResult.isError, textOf(folderResult))
      const folderData = structuredOf<{
        bookmark: { id: string; type: string }
      }>(folderResult)
      assert.strictEqual(folderData.bookmark.type, 'folder')
      const folderId = folderData.bookmark.id

      // Create bookmark
      const bmResult = await execute(create_bookmark, {
        title: 'Movable Bookmark',
        url: 'https://example.com/movable',
      })
      const bmId = structuredOf<{ bookmark: { id: string } }>(bmResult).bookmark
        .id

      // Move into folder
      const moveResult = await execute(move_bookmark, {
        id: bmId,
        parentId: folderId,
      })
      assert.ok(!moveResult.isError, textOf(moveResult))
      const moveData = structuredOf<{ bookmark: { parentId?: string } }>(
        moveResult,
      )
      assert.strictEqual(moveData.bookmark.parentId, folderId)

      // Cleanup
      await execute(remove_bookmark, { id: folderId })
    })
  }, 60_000)
})
