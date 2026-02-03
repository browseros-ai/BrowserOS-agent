/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  click,
  drag,
  fill,
  fillForm,
  hover,
  uploadFile,
} from '../../../src/tools/cdp-based/input'
import { CdpResponse } from '../../../src/tools/cdp-based/upstream/response'

import { serverHooks } from '../../__fixtures__/server'
import { html, withCdpBrowser } from '../../__helpers__/utils'

function messageFrom(result: {
  structuredContent: Record<string, unknown>
}): string {
  return String(result.structuredContent.message ?? '')
}

function findUidByName(context: any, name: string): string {
  const snapshot = context.getTextSnapshot?.()
  assert.ok(snapshot, 'Expected text snapshot to be available')
  for (const node of snapshot.idToNode.values()) {
    if (node?.name === name) {
      return node.id
    }
  }
  throw new Error(`No node found in snapshot with name "${name}"`)
}

describe('input', () => {
  const server = serverHooks()

  it('click - clicks', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(
        `<!DOCTYPE html><button aria-label="btn" onclick="this.innerText = 'clicked';">test`,
      )
      await context.createTextSnapshot()

      const response = new CdpResponse()
      const uid = findUidByName(context, 'btn')
      await click.handler(
        { params: { uid, includeSnapshot: true } },
        response,
        context,
      )
      const result = await response.handle(click.name, context)

      assert.ok(
        messageFrom(result).includes('Successfully clicked on the element'),
      )
      assert.ok(result.structuredContent.snapshot)
      assert.ok(await page.$('text/clicked'))
    })
  })

  it('click - double clicks', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(
        `<!DOCTYPE html><button aria-label="btn" ondblclick="this.innerText = 'dblclicked';">test`,
      )
      await context.createTextSnapshot()

      const response = new CdpResponse()
      const uid = findUidByName(context, 'btn')
      await click.handler(
        { params: { uid, dblClick: true, includeSnapshot: true } },
        response,
        context,
      )
      const result = await response.handle(click.name, context)
      assert.ok(
        messageFrom(result).includes(
          'Successfully double clicked on the element',
        ),
      )
      assert.ok(result.structuredContent.snapshot)
      assert.ok(await page.$('text/dblclicked'))
    })
  })

  it('click - waits for navigation', async () => {
    const resolveNavigation = Promise.withResolvers<void>()
    server.addHtmlRoute('/link', html`<a href="/navigated">Navigate page</a>`)
    server.addRoute('/navigated', async (_req, res) => {
      await resolveNavigation.promise
      res.write(html`<main>I was navigated</main>`)
      res.end()
    })

    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.goto(server.getRoute('/link'))
      await context.createTextSnapshot()

      const response = new CdpResponse()
      const uid = findUidByName(context, 'Navigate page')
      const clickPromise = click.handler({ params: { uid } }, response, context)

      const [t1, t2] = await Promise.all([
        clickPromise.then(() => Date.now()),
        new Promise<number>((res) => {
          setTimeout(() => {
            resolveNavigation.resolve()
            res(Date.now())
          }, 300)
        }),
      ])

      assert(t1 > t2, 'Waited for navigation')
    })
  })

  it('click - waits for stable DOM', async () => {
    server.addHtmlRoute(
      '/unstable',
      html`
        <button>Click to change to see time</button>
        <script>
          const button = document.querySelector('button')
          button.addEventListener('click', () => {
            setTimeout(() => {
              button.textContent = Date.now()
            }, 50)
          })
        </script>
      `,
    )

    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.goto(server.getRoute('/unstable'))
      await context.createTextSnapshot()

      const response = new CdpResponse()
      const uid = findUidByName(context, 'Click to change to see time')
      const handlerResolveTime = await click
        .handler({ params: { uid } }, response, context)
        .then(() => Date.now())

      const buttonChangeTime = await page.evaluate(() => {
        const button = document.querySelector('button')
        return Number(button?.textContent)
      })

      assert(handlerResolveTime > buttonChangeTime, 'Waited for stable DOM')
    })
  })

  it('hover - hovers', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(
        `<!DOCTYPE html><button aria-label="btn" onmouseover="this.innerText = 'hovered';">test`,
      )
      await context.createTextSnapshot()

      const response = new CdpResponse()
      const uid = findUidByName(context, 'btn')
      await hover.handler(
        { params: { uid, includeSnapshot: true } },
        response,
        context,
      )
      const result = await response.handle(hover.name, context)
      assert.ok(
        messageFrom(result).includes('Successfully hovered over the element'),
      )
      assert.ok(result.structuredContent.snapshot)
      assert.ok(await page.$('text/hovered'))
    })
  })

  it('fill - fills out an input', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(`<!DOCTYPE html><input aria-label="input">`)
      await context.createTextSnapshot()

      const uid = findUidByName(context, 'input')
      const response = new CdpResponse()
      await fill.handler(
        { params: { uid, value: 'test', includeSnapshot: true } },
        response,
        context,
      )
      const result = await response.handle(fill.name, context)
      assert.ok(
        messageFrom(result).includes('Successfully filled out the element'),
      )
      assert.ok(result.structuredContent.snapshot)
      assert.ok(await page.$('text/test'))
    })
  })

  it('drags - drags one element onto another', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(`<!DOCTYPE html>
<div role="button" id="drag" aria-label="drag" draggable="true">drag me</div>
<div id="drop" aria-label="drop"
  style="width: 100px; height: 100px; border: 1px solid black;" ondrop="this.innerText = 'dropped';">
</div>
<script>
    drag.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", event.target.id);
    });
    drop.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });
    drop.addEventListener("drop", (event) => {
        event.preventDefault();
        const data = event.dataTransfer.getData("text/plain");
        event.target.appendChild(document.getElementById(data));
    });
</script>`)
      await context.createTextSnapshot()

      const fromUid = findUidByName(context, 'drag')
      const toUid = findUidByName(context, 'drop')
      const response = new CdpResponse()
      await drag.handler(
        { params: { from_uid: fromUid, to_uid: toUid, includeSnapshot: true } },
        response,
        context,
      )
      const result = await response.handle(drag.name, context)
      assert.ok(messageFrom(result).includes('Successfully dragged an element'))
      assert.ok(result.structuredContent.snapshot)
      assert.ok(await page.$('#drop #drag'))
    })
  })

  it('fill_form - successfully fills out the form', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(`<!DOCTYPE html>
        <form>
          <input id="a" aria-label="a" />
          <input id="b" aria-label="b" />
        </form>
      `)
      await context.createTextSnapshot()

      const uidA = findUidByName(context, 'a')
      const uidB = findUidByName(context, 'b')
      const response = new CdpResponse()
      await fillForm.handler(
        {
          params: {
            elements: [
              { uid: uidA, value: 'hello' },
              { uid: uidB, value: 'world' },
            ],
            includeSnapshot: true,
          },
        },
        response,
        context,
      )
      const result = await response.handle(fillForm.name, context)
      assert.ok(
        messageFrom(result).includes('Successfully filled out the form'),
      )
      assert.ok(result.structuredContent.snapshot)
      assert.equal(await page.$eval('#a', (el: any) => el.value), 'hello')
      assert.equal(await page.$eval('#b', (el: any) => el.value), 'world')
    })
  })

  it('uploadFile - uploads a file to a file input', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(
        `<!DOCTYPE html><input type="file" aria-label="file">`,
      )
      await context.createTextSnapshot()

      const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-upload-'))
      const filePath = path.join(tmpDir, 'test.txt')
      await fs.writeFile(filePath, 'hello')

      const uid = findUidByName(context, 'file')
      const response = new CdpResponse()
      await uploadFile.handler(
        { params: { uid, filePath, includeSnapshot: true } },
        response,
        context,
      )
      const result = await response.handle(uploadFile.name, context)
      assert.ok(result.structuredContent.snapshot)
      assert.ok(messageFrom(result).includes('File uploaded'))
    })
  })
})
