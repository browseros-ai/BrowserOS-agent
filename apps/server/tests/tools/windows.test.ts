import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  activate_window,
  close_window,
  create_hidden_window,
  create_window,
  list_windows,
} from '../../src/tools/windows'
import { withBrowser } from '../__helpers__/with-browser'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

describe('window tools', () => {
  it('list_windows returns at least one window', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(list_windows, {})
      assert.ok(!result.isError, textOf(result))
      assert.ok(textOf(result).includes('Window'))
    })
  }, 60_000)

  it('create and close a window', async () => {
    await withBrowser(async ({ execute }) => {
      const createResult = await execute(create_window, {})
      assert.ok(!createResult.isError, textOf(createResult))
      const text = textOf(createResult)
      assert.ok(text.includes('Created window'))

      const windowIdMatch = text.match(/Created window\s+(\d+)/)
      assert.ok(windowIdMatch, 'Could not extract window ID')
      const windowId = Number(windowIdMatch?.[1])

      const closeResult = await execute(close_window, { windowId })
      assert.ok(!closeResult.isError, textOf(closeResult))
      assert.ok(textOf(closeResult).includes('Closed window'))
    })
  }, 60_000)

  it('activate_window focuses a window', async () => {
    await withBrowser(async ({ execute }) => {
      const listResult = await execute(list_windows, {})
      const windowIdMatch = textOf(listResult).match(/Window\s+(\d+)/)
      assert.ok(windowIdMatch, 'No window found')
      const windowId = Number(windowIdMatch?.[1])

      const activateResult = await execute(activate_window, { windowId })
      assert.ok(!activateResult.isError, textOf(activateResult))
      assert.ok(textOf(activateResult).includes('Activated'))
    })
  }, 60_000)

  it('create_hidden_window creates and closes a hidden window', async () => {
    await withBrowser(async ({ execute }) => {
      const createResult = await execute(create_hidden_window, {})
      assert.ok(!createResult.isError, textOf(createResult))
      const text = textOf(createResult)
      assert.ok(text.includes('Created hidden window'))

      const windowIdMatch = text.match(/Created hidden window\s+(\d+)/)
      assert.ok(windowIdMatch, 'Could not extract window ID')
      const windowId = Number(windowIdMatch?.[1])

      const listResult = await execute(list_windows, {})
      assert.ok(
        textOf(listResult).includes(`Window ${windowId}`),
        'Hidden window should appear in list',
      )

      const closeResult = await execute(close_window, { windowId })
      assert.ok(!closeResult.isError, textOf(closeResult))
    })
  }, 60_000)
})
