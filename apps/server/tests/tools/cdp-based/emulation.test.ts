/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { emulate } from '../../../src/tools/cdp-based/emulation'
import { CdpResponse } from '../../../src/tools/cdp-based/upstream/response'

import { withCdpBrowser } from '../../__helpers__/utils'

describe('emulation', () => {
  it('emulate - sets network throttling', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await emulate.handler(
        { params: { networkConditions: 'Slow 3G' } },
        response,
        context,
      )
      assert.strictEqual(context.getNetworkConditions(), 'Slow 3G')
    })
  })

  it('emulate - disables network emulation', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await emulate.handler(
        { params: { networkConditions: 'No emulation' } },
        response,
        context,
      )
      assert.strictEqual(context.getNetworkConditions(), null)
    })
  })

  it('emulate - sets cpu throttling', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await emulate.handler(
        { params: { cpuThrottlingRate: 4 } },
        response,
        context,
      )
      assert.strictEqual(context.getCpuThrottlingRate(), 4)
    })
  })

  it('emulate - keeps per-page state', async () => {
    await withCdpBrowser(async (_response, context) => {
      const pagesBefore = context.getPages()
      assert.ok(pagesBefore[0])

      const response = new CdpResponse()
      const newPg = await context.newPage()
      const firstPage = pagesBefore[0]

      await emulate.handler(
        { params: { networkConditions: 'Slow 3G' } },
        response,
        context,
      )
      assert.ok(context.isPageSelected(newPg))
      assert.strictEqual(context.getNetworkConditions(), 'Slow 3G')

      context.selectPage(firstPage)
      assert.ok(context.isPageSelected(firstPage))
      assert.strictEqual(context.getNetworkConditions(), null)
    })
  })
})
