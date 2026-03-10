import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { get_dom, search_dom } from '../../src/tools/dom'
import { close_page, new_page } from '../../src/tools/navigation'
import { evaluate_script } from '../../src/tools/snapshot'
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

function domPathOf(result: { structuredContent?: unknown }): string {
  const data = structuredOf<{ path: string }>(result)
  assert.ok(data.path, 'Expected saved DOM path')
  return data.path
}

function pageIdOf(result: {
  content: { type: string; text?: string }[]
  structuredContent?: unknown
}): number {
  const data = result.structuredContent as { pageId?: number } | undefined
  if (typeof data?.pageId === 'number') return data.pageId
  return Number(textOf(result).match(/Page ID:\s*(\d+)/)?.[1])
}

const RICH_PAGE = `data:text/html,${encodeURIComponent(`<!DOCTYPE html>
<html><head><title>DOM Test Page</title></head><body>
  <header id="main-header">
    <nav aria-label="Primary navigation">
      <a href="/home" class="nav-link">Home</a>
      <a href="/about" class="nav-link">About</a>
      <a href="/contact" class="nav-link">Contact</a>
    </nav>
  </header>
  <main id="content">
    <h1>Welcome to Test Page</h1>
    <p class="intro">This is an introductory paragraph with some text.</p>
    <form id="login-form" action="/login" method="post">
      <label for="email">Email</label>
      <input id="email" type="email" name="email" placeholder="Enter email" aria-label="Email address" />
      <label for="password">Password</label>
      <input id="password" type="password" name="password" placeholder="Enter password" />
      <button id="submit-btn" type="submit" class="btn primary" data-testid="login-submit">Log In</button>
    </form>
    <section id="features">
      <h2>Features</h2>
      <ul>
        <li class="feature-item">Feature One</li>
        <li class="feature-item">Feature Two</li>
        <li class="feature-item">Feature Three</li>
      </ul>
    </section>
    <footer>
      <p>Copyright 2025 Test Corp</p>
    </footer>
  </main>
</body></html>`)}`

// ── get_dom ──

describe('get_dom', () => {
  it('returns full page HTML', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)
      let domPath: string | undefined

      try {
        const result = await execute(get_dom, { page: pageId })
        assert.ok(!result.isError, textOf(result))
        domPath = domPathOf(result)
        const html = readFileSync(domPath, 'utf8')

        assert.ok(textOf(result).includes('Saved DOM'))
        assert.ok(existsSync(domPath), 'Saved DOM file should exist')
        assert.ok(
          domPath.startsWith(join(process.cwd(), 'tool-output')),
          'Saved DOM file should be written under executionDir/tool-output',
        )
        assert.ok(html.includes('<html'), 'Should contain <html> tag')
        assert.ok(html.includes('</html>'), 'Should contain closing </html>')
        assert.ok(html.includes('id="login-form"'), 'Should contain form ID')
        assert.ok(
          html.includes('Welcome to Test Page'),
          'Should contain heading text',
        )
        assert.ok(html.includes('<head>'), 'Full page should include <head>')
        const data = structuredOf<{
          path: string
          totalLength: number
        }>(result)
        assert.strictEqual(data.path, domPath)
        assert.strictEqual(data.totalLength, html.length)
      } finally {
        if (domPath && existsSync(domPath)) unlinkSync(domPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)

  it('scopes to a CSS selector', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)
      let domPath: string | undefined

      try {
        const result = await execute(get_dom, {
          page: pageId,
          selector: '#login-form',
        })
        assert.ok(!result.isError, textOf(result))
        domPath = domPathOf(result)
        const html = readFileSync(domPath, 'utf8')

        assert.ok(html.includes('<form'), 'Should contain <form>')
        assert.ok(html.includes('id="login-form"'), 'Should contain form ID')
        assert.ok(html.includes('type="email"'), 'Should contain email input')
        assert.ok(
          html.includes('type="password"'),
          'Should contain password input',
        )
        assert.ok(
          !html.includes('<nav'),
          'Scoped result should NOT contain nav element',
        )
        assert.ok(
          !html.includes('id="features"'),
          'Scoped result should NOT contain features section',
        )
      } finally {
        if (domPath && existsSync(domPath)) unlinkSync(domPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)

  it('scopes to a nested CSS selector', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)
      let domPath: string | undefined

      try {
        const result = await execute(get_dom, {
          page: pageId,
          selector: 'nav',
        })
        assert.ok(!result.isError, textOf(result))
        domPath = domPathOf(result)
        const html = readFileSync(domPath, 'utf8')

        assert.ok(html.includes('<nav'), 'Should contain <nav>')
        assert.ok(html.includes('Home'), 'Should contain nav links')
        assert.ok(html.includes('About'), 'Should contain nav links')
        assert.ok(!html.includes('<form'), 'Scoped nav should NOT contain form')
      } finally {
        if (domPath && existsSync(domPath)) unlinkSync(domPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)

  it('returns error for non-matching selector', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(get_dom, {
        page: pageId,
        selector: '#does-not-exist',
      })
      assert.ok(result.isError, 'Expected error for non-matching selector')
      assert.ok(
        textOf(result).includes('No element found'),
        'Error message should mention no element found',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('returns HTML for about:blank', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)
      let domPath: string | undefined

      try {
        const result = await execute(get_dom, { page: pageId })
        assert.ok(!result.isError, textOf(result))
        domPath = domPathOf(result)
        const html = readFileSync(domPath, 'utf8')
        assert.ok(
          html.includes('<html'),
          'about:blank should still have html element',
        )
      } finally {
        if (domPath && existsSync(domPath)) unlinkSync(domPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)

  it('writes very large DOM to disk without truncating the response body', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)
      let domPath: string | undefined

      try {
        await execute(evaluate_script, {
          page: pageId,
          expression: `
            var html = '';
            for (var i = 0; i < 10000; i++) {
              html += '<div class="item-' + i + '">Content block ' + i + ' here</div>';
            }
            document.body.innerHTML = html;
            'done'
          `,
        })

        const result = await execute(get_dom, { page: pageId })
        assert.ok(!result.isError, textOf(result))
        domPath = domPathOf(result)
        const data = structuredOf<{ totalLength: number }>(result)
        const html = readFileSync(domPath, 'utf8')

        assert.ok(textOf(result).includes('Saved DOM'))
        assert.ok(
          domPath.startsWith(join(process.cwd(), 'tool-output')),
          'Saved DOM file should be written under executionDir/tool-output',
        )
        assert.ok(data.totalLength > 100_000, 'Expected a large DOM payload')
        assert.strictEqual(html.length, data.totalLength)
        assert.ok(
          html.includes('Content block 9999 here'),
          'Saved file should contain the full DOM',
        )
      } finally {
        if (domPath && existsSync(domPath)) unlinkSync(domPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)

  it('preserves element attributes in output', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)
      let domPath: string | undefined

      try {
        const result = await execute(get_dom, {
          page: pageId,
          selector: '#submit-btn',
        })
        assert.ok(!result.isError, textOf(result))
        domPath = domPathOf(result)
        const html = readFileSync(domPath, 'utf8')

        assert.ok(html.includes('type="submit"'), 'Should preserve type attr')
        assert.ok(
          html.includes('class="btn primary"'),
          'Should preserve class attr',
        )
        assert.ok(
          html.includes('data-testid="login-submit"'),
          'Should preserve data attributes',
        )
      } finally {
        if (domPath && existsSync(domPath)) unlinkSync(domPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)
})

// ── search_dom ──

describe('search_dom', () => {
  it('finds elements by plain text', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: 'Welcome to Test Page',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.includes('Found'), 'Should report found elements')
      assert.ok(
        text.includes('matching elements'),
        'Should include match count',
      )
      const data = structuredOf<{
        query: string
        shownCount: number
        totalCount: number
      }>(result)
      assert.strictEqual(data.query, 'Welcome to Test Page')
      assert.ok(data.totalCount >= data.shownCount)

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('finds elements by CSS selector', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: 'input[type="email"]',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.includes('Found'), 'Should find the email input')
      assert.ok(text.includes('<input'), 'Should include input element')
      assert.ok(
        text.includes('type="email"'),
        'Should show email type attribute',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('finds elements by XPath', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '//button[@type="submit"]',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.includes('Found'), 'Should find the submit button')
      assert.ok(text.includes('<button'), 'Should include button element')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('finds multiple elements with CSS class selector', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '.nav-link',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.includes('Found 3'), 'Should find exactly 3 nav links')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('finds elements by ID selector', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '#login-form',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.includes('Found'), 'Should find the form by ID')
      assert.ok(text.includes('<form'), 'Should be a form element')
      assert.ok(
        text.includes('id="login-form"'),
        'Should include the id attribute',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('returns no-match message for non-existent content', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '#element-that-absolutely-does-not-exist-xyz',
      })
      assert.ok(!result.isError, 'Non-match is not an error')
      assert.ok(
        textOf(result).includes('No elements matching'),
        'Should report no matches',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('respects limit parameter', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '.feature-item',
        limit: 2,
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)

      // Should show the total count but limit actual results
      const nodeIdCount = (text.match(/nodeId:/g) || []).length
      assert.ok(
        nodeIdCount <= 2,
        `Expected at most 2 results, got ${nodeIdCount}`,
      )

      // Should mention there are more matches available
      assert.ok(
        text.includes('Showing 2 of 3') || text.includes('Found 3'),
        'Should indicate total matches or show pagination note',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('returns element attributes in search results', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '#email',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)

      assert.ok(text.includes('type="email"'), 'Should include type attribute')
      assert.ok(text.includes('name="email"'), 'Should include name attribute')
      assert.ok(
        text.includes('placeholder="Enter email"'),
        'Should include placeholder attribute',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('finds elements on dynamically modified page', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)

      await execute(evaluate_script, {
        page: pageId,
        expression: `
          document.body.innerHTML = '<div id="dynamic-content"><span class="dynamic-item">Dynamically Added</span></div>';
          'done'
        `,
      })

      const result = await execute(search_dom, {
        page: pageId,
        query: '#dynamic-content',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(
        text.includes('Found'),
        'Should find dynamically added elements',
      )
      assert.ok(
        text.includes('id="dynamic-content"'),
        'Should include the dynamic element ID',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('finds elements using attribute selector', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '[data-testid="login-submit"]',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.includes('Found'), 'Should find by data-testid')
      assert.ok(text.includes('<button'), 'Should be a button element')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('finds text across multiple elements', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: 'Feature',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      // "Feature" appears as text in 3 list items, plus potentially h2 and section
      const matchCount = text.match(/Found (\d+)/)?.[1]
      assert.ok(
        matchCount && Number(matchCount) >= 3,
        `Expected at least 3 matches for "Feature", got ${matchCount}`,
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('includes nodeId in search results for element reference', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: RICH_PAGE })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: '#submit-btn',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(
        text.includes('nodeId:'),
        'Should include nodeId for each result',
      )

      const nodeIdMatch = text.match(/nodeId:\s*(\d+)/)
      assert.ok(nodeIdMatch, 'nodeId should be a number')
      assert.ok(
        Number(nodeIdMatch?.[1]) > 0,
        'nodeId should be a positive number',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('handles empty page gracefully', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)

      const result = await execute(search_dom, {
        page: pageId,
        query: 'anything',
      })
      // Should either return no matches or handle gracefully
      assert.ok(!result.isError, 'Empty page search should not throw error')
      assert.ok(
        textOf(result).includes('No elements matching'),
        'Should report no matches on empty page',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)
})
