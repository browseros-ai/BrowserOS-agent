import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  check,
  click,
  fill,
  hover,
  press_key,
  scroll,
  select_option,
  uncheck,
} from '../../src/tools/input'
import { close_page, new_page } from '../../src/tools/navigation'
import { evaluate_script, take_snapshot } from '../../src/tools/snapshot'
import { withBrowser } from '../__helpers__/with-browser'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findElementId(snapshotText: string, label: string): number {
  const regex = new RegExp(`\\[(\\d+)\\].*?${escapeRegex(label)}`)
  const match = snapshotText.match(regex)
  if (!match) throw new Error(`Element "${label}" not found in snapshot`)
  return Number.parseInt(match[1], 10)
}

const FORM_PAGE = `data:text/html,${encodeURIComponent(`<!DOCTYPE html>
<html><body>
  <h1>Test Form</h1>
  <form id="test-form">
    <input id="name" type="text" placeholder="Enter name" />
    <input id="agree" type="checkbox" />
    <label for="agree">I agree</label>
    <select id="color">
      <option value="red">Red</option>
      <option value="green">Green</option>
      <option value="blue">Blue</option>
    </select>
    <button id="submit-btn" type="button">Submit</button>
  </form>
  <div id="output"></div>
  <div id="key-log"></div>
  <div style="height:3000px"></div>
  <div id="bottom">Bottom of page</div>
  <script>
    document.getElementById('submit-btn').addEventListener('click', function() {
      document.getElementById('output').textContent = 'clicked:' + document.getElementById('name').value;
    });
    document.getElementById('name').addEventListener('keydown', function(e) {
      var log = document.getElementById('key-log');
      log.textContent = (log.textContent || '') + 'keydown:' + e.key + ' ';
    });
    document.getElementById('name').addEventListener('keypress', function(e) {
      var log = document.getElementById('key-log');
      log.textContent = (log.textContent || '') + 'keypress:' + e.key + ' ';
    });
    document.getElementById('name').addEventListener('keyup', function(e) {
      var log = document.getElementById('key-log');
      log.textContent = (log.textContent || '') + 'keyup:' + e.key + ' ';
    });
  </script>
</body></html>`)}`

describe('input tools', () => {
  it('fill types text into an input', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snap = await execute(take_snapshot, { page: pageId })
      const snapText = textOf(snap)
      const inputId = findElementId(snapText, 'Enter name')

      const fillResult = await execute(fill, {
        page: pageId,
        element: inputId,
        text: 'John Doe',
      })
      assert.ok(!fillResult.isError, textOf(fillResult))

      const val = await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("name").value',
      })
      assert.strictEqual(textOf(val), 'John Doe')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('click triggers a button', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      // Fill the input first
      const snap = await execute(take_snapshot, { page: pageId })
      const snapText = textOf(snap)
      const inputId = findElementId(snapText, 'Enter name')
      await execute(fill, { page: pageId, element: inputId, text: 'Alice' })

      // Click submit
      const btnId = findElementId(snapText, 'Submit')
      const clickResult = await execute(click, {
        page: pageId,
        element: btnId,
      })
      assert.ok(!clickResult.isError, textOf(clickResult))

      const output = await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("output").textContent',
      })
      assert.strictEqual(textOf(output), 'clicked:Alice')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('check and uncheck toggle a checkbox', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snap = await execute(take_snapshot, { page: pageId })
      const snapText = textOf(snap)
      const checkboxId = findElementId(snapText, 'I agree')

      const checkResult = await execute(check, {
        page: pageId,
        element: checkboxId,
      })
      assert.ok(!checkResult.isError, textOf(checkResult))

      const checked = await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("agree").checked',
      })
      assert.strictEqual(textOf(checked), 'true')

      const uncheckResult = await execute(uncheck, {
        page: pageId,
        element: checkboxId,
      })
      assert.ok(!uncheckResult.isError, textOf(uncheckResult))

      const unchecked = await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("agree").checked',
      })
      assert.strictEqual(textOf(unchecked), 'false')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('select_option selects a dropdown value', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      // Use evaluate_script to get the select element's backendNodeId directly
      const nodeId = await execute(evaluate_script, {
        page: pageId,
        expression:
          '(() => { const el = document.getElementById("color"); return el ? el.getAttribute("id") : null })()',
      })
      assert.strictEqual(textOf(nodeId), 'color')

      // Get the select element ID from the snapshot
      const snap = await execute(take_snapshot, { page: pageId })
      const snapText = textOf(snap)

      // Find the combobox/listbox element (the <select>), not an individual option
      const comboboxMatch = snapText.match(
        /\[(\d+)\]\s*(?:combobox|listbox|PopUpButton)/,
      )
      assert.ok(comboboxMatch, `No combobox found in snapshot:\n${snapText}`)
      const selectId = Number(comboboxMatch?.[1])

      const selectResult = await execute(select_option, {
        page: pageId,
        element: selectId,
        value: 'blue',
      })
      assert.ok(!selectResult.isError, textOf(selectResult))
      assert.ok(textOf(selectResult).includes('Blue'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('press_key sends a keystroke', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snap = await execute(take_snapshot, { page: pageId })
      const inputId = findElementId(textOf(snap), 'Enter name')
      await execute(fill, { page: pageId, element: inputId, text: 'hello' })

      // Press Backspace to delete last character
      const keyResult = await execute(press_key, {
        page: pageId,
        key: 'Backspace',
      })
      assert.ok(!keyResult.isError, textOf(keyResult))
      assert.ok(textOf(keyResult).includes('Pressed Backspace'))

      const val = await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("name").value',
      })
      assert.strictEqual(textOf(val), 'hell')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('press_key Enter fires keypress event', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snap = await execute(take_snapshot, { page: pageId })
      const inputId = findElementId(textOf(snap), 'Enter name')

      await execute(fill, { page: pageId, element: inputId, text: '' })
      await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("key-log").textContent = ""',
      })

      const keyResult = await execute(press_key, {
        page: pageId,
        key: 'Enter',
      })
      assert.ok(!keyResult.isError, textOf(keyResult))

      const log = await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("key-log").textContent',
      })
      const logText = textOf(log)
      assert.ok(
        logText.includes('keydown:Enter'),
        `Expected keydown:Enter in log, got: "${logText}"`,
      )
      assert.ok(
        logText.includes('keypress:Enter'),
        `Expected keypress:Enter in log, got: "${logText}"`,
      )
      assert.ok(
        logText.includes('keyup:Enter'),
        `Expected keyup:Enter in log, got: "${logText}"`,
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('press_key normalizes case-insensitive key names', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snap = await execute(take_snapshot, { page: pageId })
      const inputId = findElementId(textOf(snap), 'Enter name')
      await execute(fill, { page: pageId, element: inputId, text: 'hello' })

      // "backspace" (lowercase) should work the same as "Backspace"
      const keyResult = await execute(press_key, {
        page: pageId,
        key: 'backspace',
      })
      assert.ok(!keyResult.isError, textOf(keyResult))

      const val = await execute(evaluate_script, {
        page: pageId,
        expression: 'document.getElementById("name").value',
      })
      assert.strictEqual(textOf(val), 'hell')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('scroll dispatches without error', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, {
        url: FORM_PAGE,
      })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const before = await execute(evaluate_script, {
        page: pageId,
        expression: 'window.scrollY',
      })

      const scrollResult = await execute(scroll, {
        page: pageId,
        direction: 'down',
        amount: 5,
      })
      assert.ok(!scrollResult.isError, textOf(scrollResult))
      assert.ok(textOf(scrollResult).includes('Scrolled down'))

      const after = await execute(evaluate_script, {
        page: pageId,
        expression: 'window.scrollY',
      })
      assert.ok(
        Number(textOf(after)) > Number(textOf(before)),
        `Expected scrollY to increase, before=${textOf(before)} after=${textOf(after)}`,
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('hover moves cursor over element', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: FORM_PAGE })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snap = await execute(take_snapshot, { page: pageId })
      const btnId = findElementId(textOf(snap), 'Submit')

      const hoverResult = await execute(hover, {
        page: pageId,
        element: btnId,
      })
      assert.ok(!hoverResult.isError, textOf(hoverResult))
      assert.ok(textOf(hoverResult).includes('Hovered'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)
})
