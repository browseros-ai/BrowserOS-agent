/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCodexRoutes } from '../../../src/api/routes/codex'
import { getCodexAuthFilePath } from '../../../src/lib/clients/llm/codex-auth'

describe('createCodexRoutes', () => {
  let tempHome: string
  let originalHome: string | undefined

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'browseros-codex-route-'))
    originalHome = process.env.HOME
    process.env.HOME = tempHome
  })

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
    fs.rmSync(tempHome, { recursive: true, force: true })
  })

  it('returns a 500 response when the local auth file is malformed', async () => {
    const authPath = getCodexAuthFilePath()
    fs.mkdirSync(path.dirname(authPath), { recursive: true })
    fs.writeFileSync(authPath, '{not-json')

    const route = createCodexRoutes()
    const response = await route.request('/status')
    const body = await response.json()

    assert.strictEqual(response.status, 500)
    assert.deepStrictEqual(body, { error: 'Failed to read Codex status' })
  })
})
